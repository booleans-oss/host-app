/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable no-await-in-loop */
import type { IConfig } from 'common';
import { randomBytes } from 'crypto';
import path from 'path';
import type { ConnectConfig, SFTPWrapper } from 'ssh2';
import SSH2 from 'ssh2';
import { injectable } from 'tsyringe';

import { SSHTimeoutException } from '../exceptions/ssh-timeout';
import { FileController } from './file.service';

@injectable()
export class SSHService {
  constructor(private files: FileController) {}

  sshconfig: IConfig;

  client?: SSH2.Client;

  sftp?: SSH2.SFTPWrapper;

  id?: string;

  connect() {
    console.warn('try to connect');
  }

  set config(config: IConfig) {
    this.sshconfig = config;
  }

  get config() {
    return this.sshconfig;
  }

  async start() {
    const client = new SSH2.Client();
    const connectionConfig = await this.parsedConfig();
    const id = randomBytes(5).toString('hex');
    await new Promise<void>((resolve, reject) => {
      client.on('error', reject);
      client.on('ready', () => {
        client.removeListener('error', reject);
        this.client = client;
        resolve();
      });
      client.on('end', () => {
        if (this.client === client) {
          this.client = undefined;
        }
      });
      client.on('close', () => {
        if (this.client === client) {
          this.client = undefined;
        }

        reject(new SSHTimeoutException());
      });
      client.on(
        'keyboard-interactive',
        (_name, _instructions, _instructionsLang, prompts, finish) => {
          if (
            prompts.length > 0 &&
            prompts[0].prompt.toLowerCase().includes('password')
          ) {
            finish([this.config.config.password]);
          }
        },
      );

      client.connect(connectionConfig);
    });
    const sftp = await this.getSFTP();
    this.sftp = sftp;
    this.id = id;
    const remotefolderPath = `/home/${this.config.config.username}/.hostapp/${this.id}`;
    await this.mkdir(remotefolderPath);
  }

  async parsedConfig() {
    return <ConnectConfig>{
      privateKey: await this.files.getPrivateKey(
        this.config.config.privateKey as string,
      ),
      passphrase: this.config.config.passphrase,
      password: this.config.config.password,
      username: this.config.config.username,
      host: this.config.config.host,
      tryKeyboard: true,
    };
  }

  async copyFiles(currentPath = process.cwd()) {
    const localPath = process.cwd();
    const rootDir = localPath.split(path.sep)[
      localPath.split(path.sep).length - 1
    ];
    const remotefolderPath = `/home/${this.config.config.username}/.hostapp/${this.id}`;

    let files = (await this.files.getFiles(currentPath)).filter(
      (element) =>
        !['node_modules', '.git', 'pnpm-lock.yaml'].includes(element),
    );

    if (currentPath === process.cwd()) {
      files = files.includes('.next')
        ? files.filter((file) => file !== '.next')
        : files.filter(
            (file) =>
              file === 'build' || file === 'dist' || file === 'package.json',
          );
    }

    for (const file of files) {
      const stat = await this.files.stat(path.join(currentPath, file));

      if (stat.isDirectory()) {
        await this.createFolder(
          path.join(currentPath, file),
          rootDir,
          remotefolderPath,
        );
        await this.copyFiles(path.join(currentPath, file));
      } else {
        await this.createFile(
          path.join(currentPath, file),
          rootDir,
          remotefolderPath,
        );
      }
    }

    return remotefolderPath;
  }

  async createFile(localPath: string, filePath: string, rootPath: string) {
    const unixDirPath = [
      '',
      ...localPath
        .split(path.sep)
        .filter((_element, index, array) => index > array.indexOf(filePath)),
    ].join(path.sep);

    const remotePath = path.join(rootPath, unixDirPath);

    await this.writeFile(localPath, remotePath);
  }

  async writeFile(localPath: string, remotePath: string) {
    const isFile = await this.itemExists(remotePath);

    if (isFile) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.sftp?.fastPut(localPath, remotePath, {}, (err) => {
        if (err === undefined) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  async createFolder(localPath: string, dirPath: string, rootPath: string) {
    const unixDirPath = [
      '',
      ...localPath
        .split(path.sep)
        .filter((_element, index, array) => index > array.indexOf(dirPath)),
    ].join(path.sep);

    const remotePath = path.join(rootPath, unixDirPath);

    await this.mkdir(remotePath);
  }

  getSFTP(): undefined | Promise<SFTPWrapper> {
    if (!this.client) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client?.sftp((err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  async mkdir(filePath: string) {
    const isFolder = await this.itemExists(filePath);

    if (isFolder) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.sftp?.mkdir(filePath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      if (error) {
        throw error;
      }
    }
  }

  async getHomeDirectory() {
    if (!this.sftp) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stats: any;

    try {
      stats = await new Promise((resolve, reject) => {
        this.sftp?.stat(
          `/home/${this.config.config.username}/.hostapp`,
          (err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          },
        );
      });
    } catch {
      console.warn('creating hostapp folder');

      try {
        await this.mkdir(`/home/${this.config.config.username}/.hostapp`);

        return console.warn('created hostapp');
      } catch (error) {
        if (error) {
          throw error;
        }
      }
    }

    if (stats) {
      if (stats.isDirectory()) {
        return;
      }

      throw new Error(
        'mkdir() failed, target already exists and is not a directory',
      );
    }
  }

  async itemExists(filePath: string) {
    try {
      return await new Promise((resolve) => {
        this.sftp?.stat(filePath, (err) => {
          if (err) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch {
      return false;
    }
  }

  async installDeps() {
    if (!this.client) {
      return;
    }

    const remotefolderPath = `/home/${this.config.config.username}/.hostapp/${this.id}`;

    // TODO: Better error handling
    return new Promise<void>((resolve, reject) => {
      this.client?.exec(
        `cd ${remotefolderPath} ; npm install`,
        {},
        (err, stream) => {
          if (err) {
            reject(err);
          }

          stream
            .on('close', () => {
              resolve();
            })
            .stderr.on('data', (data) => {
              console.warn(`STDERR: ${data}`);
              reject(data);
            });
        },
      );
    });
  }

  async startApp() {
    if (!this.client) {
      return;
    }

    const remotefolderPath = `/home/${this.config.config.username}/.hostapp/${this.id}`;

    let hasBuildFolder = true;

    try {
      hasBuildFolder = await this.hasBuildFolder();
    } catch {
      hasBuildFolder = false;
    }

    if (!hasBuildFolder) {
      console.warn('building app');
      await new Promise((resolve, reject) => {
        this.client?.exec(
          `cd ${remotefolderPath} ; npm run build`,
          {},
          (err, stream) => {
            if (err) {
              reject(err);
            }

            // TODO: better error handling
            stream
              .on('close', (data) => {
                resolve(data);
              })
              .on('data', (data) => {
                console.warn(`STDOUT: ${data}`);
              })
              .stderr.on('data', (data) => {
                reject(data);
              });
          },
        );
      });
    }

    console.warn('build re-done');

    return new Promise<void>((resolve, reject) => {
      this.client?.exec(
        `cd ${remotefolderPath} ; pm2 start npm --name "hostapp-${this.id}" -- start`,
        {},
        (err) => {
          if (err) {
            return reject(err);
          }

          console.warn('start up done');

          return resolve();
        },
      );
    });
  }

  async hasBuildFolder() {
    const promises = ['dist', 'build'].map(
      (folder) =>
        new Promise((resolve, reject) => {
          this.sftp?.stat(
            `/home/${this.config.config.username}/.hostapp/${this.id}/${folder}`,
            (err, res) => {
              if (err) {
                return reject(err);
              }

              return resolve(res);
            },
          );
        }),
    );

    return !(await Promise.all(promises)).includes('rejected');
  }

  async createNginxConfig() {
    const config = this.config.config;

    const port = this.getRandomNumber();

    const nginxConfig = `
server {
    listen 80;
    server_name ${config.host};
    location / {
        proxy_pass http://localhost:${port};
    }
  }`;
    const nginxFile = await this.files.createFile(
      'nginx.conf',
      nginxConfig,
      'utf8',
    );
    console.warn(nginxFile);
  }

  getRandomNumber() {
    return (Math.random() * (9999 - 1000) + 1000).toFixed(0);
  }
}
