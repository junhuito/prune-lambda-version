export enum ResourceType {
  FUNCTION = 'AWS::Lambda::Function',
  LAYER = 'AWS::Lambda::LayerVersion'
}

export enum ResourcesStatus {
  CREATE_COMPLETE = 'CREATE_COMPLETE',
  UPDATE_COMPLETE = 'UPDATE_COMPLETE'
}
