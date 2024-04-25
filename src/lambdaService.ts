import { StackResourceSummary } from '@aws-sdk/client-cloudformation'
import * as core from '@actions/core'
import { isValidResourceStatus, onlyUnique } from './utils'
import { ResourceType } from './constants'
import {
  DeleteFunctionCommand,
  LambdaClient,
  ListAliasesCommand,
  ListVersionsByFunctionCommand
} from '@aws-sdk/client-lambda'

const clientConfig = {
  region: core.getInput('REGION'),
  credentials: {
    accessKeyId: core.getInput('ACCESS_KEY_ID'),
    secretAccessKey: core.getInput('SECRET_ACCESS_KEY')
  }
}

const lambdaClient = new LambdaClient(clientConfig)

async function getLambdaVersions(functionName: string): Promise<string[]> {
  let firstCalled = false
  let marker: string | undefined

  let output: string[] = []

  while (!firstCalled || !!marker) {
    const command = new ListVersionsByFunctionCommand({
      FunctionName: functionName,
      Marker: marker
    })

    const response = await lambdaClient.send(command)

    const lambdaVersion: string[] = []
    response.Versions?.forEach(x => {
      const isLatest = x.Version === '$LATEST'

      if (!isLatest && x.Version) {
        lambdaVersion.push(x.Version)
      }
    })

    output = [...output, ...lambdaVersion]

    marker = response.NextMarker
    firstCalled = true
  }

  return output.filter(onlyUnique)
}

async function getLambdaAliasVersions(functionName: string): Promise<string[]> {
  let firstCalled = false
  let marker: string | undefined

  let output: string[] = []

  while (!firstCalled || !!marker) {
    const command = new ListAliasesCommand({
      FunctionName: functionName,
      Marker: marker
    })

    const response = await lambdaClient.send(command)

    const aliasVersions: string[] = []

    response.Aliases?.forEach(alias => {
      if (alias.FunctionVersion) {
        aliasVersions.push(alias.FunctionVersion)
      }
      const aliasFunctionVersionWeights = Object.keys(
        alias.RoutingConfig?.AdditionalVersionWeights ?? {}
      )

      aliasVersions.push(...aliasFunctionVersionWeights)
    })

    output = [...output, ...aliasVersions]

    marker = response.NextMarker
    firstCalled = true
  }

  return output
}

async function deleteLambdaVersions(functionName: string, versions: string[]) {
  const promises = versions.map(version => {
    const deleteCommand = new DeleteFunctionCommand({
      FunctionName: functionName,
      Qualifier: version
    })
    return lambdaClient.send(deleteCommand)
  })

  core.info(`Deleting ${functionName} versions: ${JSON.stringify(versions)}`)

  await Promise.all(promises)
}

async function pruneLambdaVersion(
  functionName: string,
  retainVersion = 3
): Promise<void> {
  const lambdaVersions = await getLambdaVersions(functionName)
  const lambdaAliasVersions = await getLambdaAliasVersions(functionName)

  const versions = lambdaVersions.filter(v => !lambdaAliasVersions.includes(v))

  const versionToDelete = [...versions]
    .sort((a, b) => Number(b) - Number(a))
    .slice(retainVersion)

  await deleteLambdaVersions(functionName, versionToDelete)
}

export async function handlePruneLambdaVersion(
  stackResourcesSummary: StackResourceSummary[],
  retainVersion = 3
) {
  const lambdaFunctions: string[] = []

  stackResourcesSummary.forEach(resource => {
    if (
      resource.ResourceType === ResourceType.FUNCTION &&
      isValidResourceStatus(resource.ResourceStatus) &&
      resource.PhysicalResourceId
    ) {
      lambdaFunctions.push(resource.PhysicalResourceId)
    }
  })

  const promises = lambdaFunctions.map(async functionName => {
    await pruneLambdaVersion(functionName, retainVersion)
  })

  await Promise.allSettled(promises)
}
