import {
  LambdaClient,
  ListLayerVersionsCommand,
  DeleteLayerVersionCommand
} from '@aws-sdk/client-lambda'
import * as core from '@actions/core'
import { StackResourceSummary } from '@aws-sdk/client-cloudformation'
import { ResourceType } from './constants'
import {
  chunk,
  getLayerInfoByArn,
  isValidResourceStatus,
  onlyUnique
} from './utils'

const clientConfig = {
  region: core.getInput('REGION'),
  credentials: {
    accessKeyId: core.getInput('ACCESS_KEY_ID'),
    secretAccessKey: core.getInput('SECRET_ACCESS_KEY')
  }
}

const lambdaClient = new LambdaClient(clientConfig)

async function getLayerVersions(layerName: string): Promise<number[]> {
  let firstCalled = false
  let marker: string | undefined

  let output: number[] = []

  while (!firstCalled || !!marker) {
    const command = new ListLayerVersionsCommand({
      LayerName: layerName,
      Marker: marker
    })

    const response = await lambdaClient.send(command)

    const layerVersions: number[] = []

    response.LayerVersions?.forEach(x => {
      if (typeof x.Version !== 'undefined') {
        layerVersions.push(x.Version)
      }
    })

    output = [...output, ...layerVersions]

    marker = response.NextMarker
    firstCalled = true
  }

  return output.filter(onlyUnique)
}

async function deleteLayerVersions(layerName: string, versions: number[]) {
  const chunkedVersions = chunk(versions, 20)

  for (const chunkedVersion of chunkedVersions) {
    const promises = chunkedVersion.map(version => {
      const deleteCommand = new DeleteLayerVersionCommand({
        LayerName: layerName,
        VersionNumber: version
      })
      return lambdaClient.send(deleteCommand)
    })

    await Promise.all(promises)
  }

  core.info(`Deleted ${layerName} versions: ${JSON.stringify(versions)}`)
}

async function pruneLayerVersion(layerName: string, retainVersion = 3) {
  const layerVersions = await getLayerVersions(layerName)

  const versionToDelete = [...layerVersions]
    .sort((a, b) => b - a)
    .slice(retainVersion)

  await deleteLayerVersions(layerName, versionToDelete)
}

export async function handlePruneLayerVersion(
  stackResources: StackResourceSummary[],
  retainVersion = 3
) {
  const layersResources = stackResources.filter(
    resource =>
      resource.ResourceType === ResourceType.LAYER &&
      isValidResourceStatus(resource.ResourceStatus)
  )

  const layersName: string[] = []
  layersResources.forEach(layer => {
    if (layer.PhysicalResourceId) {
      const { layerName } = getLayerInfoByArn(layer.PhysicalResourceId)
      layersName.push(layerName)
    } else {
      core.warning(`Missing layer arn: ${JSON.stringify(layer)}`)
    }
  })

  const uniqueLayersName = layersName.filter(onlyUnique)

  const promises = uniqueLayersName.map(async layerName => {
    await pruneLayerVersion(layerName, retainVersion)
  })

  await Promise.allSettled(promises)
}
