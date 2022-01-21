import { promises as fs } from 'fs';
import { injectable } from 'tsyringe';

@injectable()
export class FileController {
  getPrivateKey(pathKey: string) {
    return fs.readFile(pathKey, { encoding: 'utf-8' });
  }

  getFiles(directory: string) {
    return fs.readdir(directory);
  }

  stat(path: string) {
    return fs.lstat(path);
  }

  async createFile(path: string, content: string, encoding?: BufferEncoding) {
    await fs.writeFile(path, content, encoding);

    return fs.readFile(path);
  }
}
