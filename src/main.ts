import * as core from '@actions/core'
import { getAllStackResources } from './cloudformationService'
import { handlePruneLambdaVersion } from './lambdaService'

export async function run(): Promise<void> {
  try {
    const stackName: string = core.getInput('STACK_NAME')
    const functionVersionToRetain: number = Number(
      core.getInput('RETAIN_FUNCTION_VERSION')
    )

    const stackResources = await getAllStackResources(stackName)

    if (Number.isNaN(functionVersionToRetain)) {
      throw new Error('RETAIN_FUNCTION_VERSION must be a number')
    }

    await handlePruneLambdaVersion(stackResources, functionVersionToRetain)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
