/* A component fetched on first use. A tab left open across a deploy asks for
   the old build's file, which is gone, so a failed fetch reloads the page onto
   the current build, once per address, as a failed route chunk does. */

import { defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue'

import { isChunkLoadError, reloadOntoCurrentBuild } from './chunkRecovery'

export const defineLazyComponent = <T extends Component>(loader: AsyncComponentLoader<T>) =>
  defineAsyncComponent({
    loader,
    onError: (error, _retry, fail) => {
      const { pathname, search, hash } = window.location
      if (!isChunkLoadError(error) || !reloadOntoCurrentBuild(pathname + search + hash)) fail()
    },
  })
