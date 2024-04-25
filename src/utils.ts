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
