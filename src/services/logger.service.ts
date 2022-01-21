/* eslint-disable no-console */
import { injectable } from 'tsyringe';

@injectable()
export class LogService {
  help() {
    return console.log(`
       host-app [args]

  Options:
    -H   --help  Show help                                                    [boolean]`);
  }

  noConfigFile() {
    return console.log(
      "No config file was found. Please do 'host-app config' before trying to host an app.",
    );
  }
}
