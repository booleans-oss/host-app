import type { IConfig } from 'common';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { injectable } from 'tsyringe';

@injectable()
export class ConfigService {
  async getConfig(): Promise<IConfig | undefined> {
    const homeDir = this.getHomeDir();
    const configPath = path.join(homeDir, '.hostconfig');

    try {
      await fs.access(configPath);
    } catch {
      return undefined;
    }

    const buffer = await fs.readFile(configPath);

    return <IConfig>(this.configParser(buffer) as unknown);
  }

  getHomeDir(): string {
    return os.homedir();
  }

  configParser(chunk: Buffer) {
    const readableConfig = chunk.toString();
    const headIndexes = [
      ...readableConfig
        .split('\n')
        .map((_, index) => index)
        .filter((element) =>
          readableConfig.split('\n')[element].startsWith('[['),
        ),
      readableConfig.split('\n').length,
    ];
    const [config, cloud] = readableConfig
      .split('\n')
      .filter(
        (line) => !line.startsWith('[[') && !line.endsWith(']]') && line !== '',
      )
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce<Array<Record<string, string>>>((arr, val) => {
        const index = readableConfig.split('\n').indexOf(val);
        const [key, value] = val
          .trim()
          .split(':')
          .map((el) => el.trim());

        for (let i = 0; i < headIndexes.length; i++) {
          if (index >= headIndexes[i] && index < headIndexes[i + 1]) {
            if (arr[i]) {
              arr[i] = {
                ...arr[i],
                [key]: value,
              };
            } else {
              arr[i] = { [key]: value };
            }
          }
        }

        return arr;
      }, []);

    return {
      config,
      cloud,
    };
  }
}
