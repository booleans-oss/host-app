export interface IConfig {
  config: IGeneralConfig;
  cloud: ICloudCOnfig;
}

export interface IGeneralConfig {
  host: string;
  username: string;
  password: string;
  privateKey?: string;
  passphrase?: string;
}

export interface ICloudCOnfig {
  key: string;
}
