<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'About',
  url: 'about',
  locale: 'en',
})
</script>

<template>
  <article>
    <h1>AFK Journey Arena Simulator</h1>
    <p>
      Stargazer is an AFK Journey arena simulator and planning tool. It lets you experiment with
      different hero positions and team compositions on a hexagonal grid, just like the actual
      game's battle arena.
    </p>
    <p>
      The purpose of this tool is to allow rapid testing of skill mechanics with different arena
      formations, visualize their attack ranges, and share your formations with friends or guild
      members to discuss tactics. For comprehensive formation building with full features, we
      recommend using <a href="https://www.yaphalla.com/editor">Yaphalla's builder</a>.
    </p>

    <h2>How to Use</h2>
    <ul>
      <li>
        <strong>Build Teams:</strong> Drag characters and artifacts onto the grid or click them to
        add, remove, or switch teams
      </li>
      <li>
        <strong>Simulation Details:</strong> Toggle to show/hide different simulation information:
        <ul>
          <li><strong>Flat View:</strong> Display the grid in a top-down flat view</li>
          <li><strong>Grid Info:</strong> Show hex coordinates and tile information</li>
          <li><strong>Skills:</strong> Simulate skill effects of character currently on the map</li>
          <li><strong>Targeting:</strong> Simulate attack ranges and movement paths</li>
          <li><strong>Debug:</strong> Show debug information for troubleshooting</li>
        </ul>
      </li>
      <li><strong>Create Maps:</strong> Use Map Editor tab to design custom arenas</li>
      <li>
        <strong>Share Teams:</strong> Click "Link" for shareable URL, "Copy" for image to clipboard,
        or "Download" to save image
      </li>
    </ul>

    <h2>Tips</h2>
    <ul>
      <li>Heroes with special abilities will modify the map or display special effects</li>
      <li>Click any grid tile to quickly place characters via a popup menu</li>
      <li>The grid is fully responsive - works seamlessly on mobile, tablet, and desktop!</li>
    </ul>

    <h2>Useful Links and Resources</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>: Team formation builder, priority list
        builder, and database.
      </li>
      <li><a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>: AFKJ database and guides.</li>
      <li>Special thanks to Milan for information on hero skills and temp buff mechanics.</li>
      <li>
        Image assets courtesy of <a href="https://www.yaphalla.com/">Yaphalla</a> and
        <a href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >.
      </li>
    </ul>
  </article>
</template>
