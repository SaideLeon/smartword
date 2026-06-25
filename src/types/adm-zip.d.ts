declare module 'adm-zip' {
  type ZipEntry = {
    getData(): Buffer;
  };

  export default class AdmZip {
    constructor(buffer?: Buffer);
    addFile(entryName: string, content: Buffer): void;
    getEntry(entryName: string): ZipEntry | null;
    toBuffer(): Buffer;
  }
}
