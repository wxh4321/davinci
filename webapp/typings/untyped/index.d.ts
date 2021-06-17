declare module "*.json" {
  const value: any;
  export default value;
}

declare module "*.less" {
  export default value;
  const value: any;
}

declare module "*.png" {
  const value: any;
  export default value
}

declare type valueof<T> = T[keyof T]
