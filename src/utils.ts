import { ResourcesStatus } from './constants'

export const isValidResourceStatus = (status = '') =>
  (
    [
      ResourcesStatus.CREATE_COMPLETE,
      ResourcesStatus.UPDATE_COMPLETE
    ] as string[]
  ).includes(status)

export const onlyUnique = <T>(value: T, index: number, array: T[]) => {
  return array.indexOf(value) === index
}

export const getLayerInfoByArn = (() => {
  const regex = /^arn:aws:lambda:(\w+-\w+-\w+):(\d+):layer:(.*):(\d+)$/

  return (arn: string) => {
    const match = arn.match(regex)
    if (match) {
      const [, region, accountId, layerName, version] = match
      return {
        region,
        accountId,
        layerName,
        version
      }
    } else {
      throw new Error(
        `An error occurred: The provided ARN (${arn}) does not match the expected format for a lambda layer ARN.`
      )
    }
  }
})()

export const retryReqeust = async (
  promise: any,
  retries: number = 3,
  when = (e: unknown) => true
) => {
  return promise.catch((error: unknown) => {
    if (retries > 0) {
      return retryReqeust(promise, retries - 1)
    } else {
      throw error
    }
  })
}

export const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_: any, i: number) =>
    arr.slice(i * size, i * size + size)
  )
