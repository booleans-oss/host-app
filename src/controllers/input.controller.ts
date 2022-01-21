import { exec } from 'child_process';
import { injectable } from 'tsyringe';

import { ConfigService, LogService, SSHService } from '../services';

@injectable()
export class InputController {
  constructor(
    private logger: LogService,
    private config: ConfigService,
    private ssh: SSHService,
  ) {
    this.logger = logger;
    this.config = config;
    this.ssh = ssh;
  }

  async start() {
    const args = new Set(
      process.argv.filter((arg: string) => arg.startsWith('-')),
    );

    if (args.has('--help') || args.has('-H')) {
      this.logger.help();
    } else {
      const config = await this.config.getConfig();

      if (!config) {
        return this.logger.noConfigFile();
      }

      try {
        this.ssh.config = config;
        // await this.buildApp();
        // console.warn('build done');
        // await this.ssh.start();
        // console.warn('ssh done');
        // await this.ssh.getHomeDirectory();
        // console.warn('home dir done');
        // await this.ssh.copyFiles();
        // console.warn('app done');
        // await this.ssh.installDeps();
        // console.warn('dep done');
        // await this.ssh.startApp();
        // console.warn('start done');
        await this.ssh.createNginxConfig();
      } catch (error) {
        if (error) {
          throw error;
        }
      }
    }
  }

  async buildApp() {
    return new Promise((resolve, reject) => {
      exec('npm run build', (err, stdout) => {
        if (err) {
          reject(err);
        }

        resolve(stdout);
      });
    });
  }
}
