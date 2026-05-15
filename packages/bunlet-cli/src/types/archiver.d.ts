declare module 'archiver' {
  import { Readable } from 'stream';

  interface ArchiverOptions {
    zlib?: { level?: number };
  }

  interface EntryData {
    name: string;
    date?: Date | string;
    prefix?: string;
    stats?: import('fs').Stats;
  }

  class Archiver extends Readable {
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    append(source: Buffer | Readable | string, data?: EntryData): this;
    directory(dirpath: string, destpath: string | false): this;
    file(filename: string, data: EntryData): this;
    glob(pattern: string, options?: object, data?: EntryData): this;
    finalize(): Promise<void>;
    pointer(): number;
    symlink(filepath: string, target: string): this;
  }

  function archiver(format: 'zip' | 'tar' | 'json', options?: ArchiverOptions): Archiver;
  export = archiver;
}
