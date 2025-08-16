<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import GridSnippet from '@/components/grid/GridSnippet.vue'
import PageContainer from '@/components/ui/PageContainer.vue'

const route = useRoute()
const skillName = computed(() => route.params.name as string)

// Extract the template content for each skill
const skillContent = computed(() => {
  const name = skillName.value?.toLowerCase()
  return name ? skillData[name as keyof typeof skillData] : null
})

// Define skill data (we'll need to extract this from the modal components)
const skillData = {
  silvina: {
    title: 'Silvina - First Strike',
    gridStyle: {
      numericLabel: {
        42: 1,
        39: 2,
        33: 3,
        30: 4,
        34: 5,
        40: 6,
        44: 8,
        41: 9,
        36: 10,
        29: 11,
        26: 12,
        23: 13,
        27: 14,
        31: 15,
        38: 16,
        43: 17,
        45: 18,
      },
      highlight: [9, 37],
      highlight2: [30, 33, 34, 39, 40, 42],
      highlight3: [23, 26, 27, 29, 31, 36, 38, 41, 43, 44, 45],
      character: {
        silvina: 9,
      },
      imaginaryHexes: [
        {
          relativeToHex: 45,
          direction: 'east' as const,
          label: 7,
        },
      ],
    },
  },
  reinier: {
    title: 'Reinier - Dynamic Balance',
    gridStyle: {
      numericLabel: {
        4: 1,
        7: 2,
        6: 3,
        12: 4,
        13: 5,
        16: 6,
      },
      highlight: [9],
      character: {
        reinier: 9,
      },
    },
  },
  vala: {
    title: 'Vala - Notice Beforehand',
    gridStyle: null,
  },
  dunlingr: {
    title: 'Dunlingr - Bell of Order',
    gridStyle: null,
  },
}
</script>

<template>
  <PageContainer v-if="skillContent" maxWidth="800px">
    <h1>{{ skillContent.title }}</h1>

    <!-- Silvina content -->
    <template v-if="skillName === 'silvina'">
      <p>
        Silvina marks the closest enemy in a symmetrical position, flashes next to them, and
        launches an attack when a battle starts.
      </p>

      <h2>How It Works</h2>
      <p>
        Silvina first checks her symmetrical tile (the mirror position across the grid's center). If
        an enemy is there, they become the target.
      </p>
      <p>
        If the symmetrical tile is empty, Silvina searches for the nearest enemy to that position
        using an expanding clockwise spiral pattern:
      </p>
      <ul>
        <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
        <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
        <li>And so on...</li>
      </ul>
      <GridSnippet v-if="skillContent.gridStyle" :gridStyle="skillContent.gridStyle" />
      <p>
        Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally) walks
        counter-clockwise from bottom-left (180° rotation).
      </p>
      <p>(Credit: rkkñ for documenting Silvina's targeting mechanics)</p>
    </template>

    <!-- Reinier content -->
    <template v-else-if="skillName === 'reinier'">
      <p>
        Reinier's Dynamic Balance skill connects an adjacent ally's position with an enemy hero if
        they're in a symmetrical position. At the start of the battle the connected ally and enemy's
        positions are swapped, the ally receives a buff and the enemy receives a debuff.
      </p>

      <h2>How It Works</h2>
      <p>
        Reinier identifies symmetrical hex pairs where one contains an ally and the other contains
        an enemy.
      </p>

      <h2>Tie-Breaking Rules</h2>
      <p>
        When multiple ally-enemy pairs are present, use the following rules to handle tie-break:
      </p>
      <ul>
        <li>
          <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left > Left >
          Bottom-right > Right > Top-left > Top-right
        </li>
        <li>
          <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right > Top-left
          > Right > Bottom-right > Left > Bottom-left (This is a 180-degree rotation of the ally
          priority)
        </li>
      </ul>

      <GridSnippet v-if="skillContent.gridStyle" :gridStyle="skillContent.gridStyle" />
    </template>

    <!-- Vala content -->
    <template v-else-if="skillName === 'vala'">
      <p>
        Vala's Notice Beforehand skill targets the enemy furthest from her current position at the
        start of the battle. During battle Vala will attacks the Noticed enemy in priority, and
        absorb energy for each hit.
      </p>

      <h2>How It Works</h2>
      <p>
        Vala automatically identifies and targets an opposing team's character that is furthest away
        from her current tile.
      </p>
      <p>Distance calculation uses hexagonal grid distance to determine the furthest enemy.</p>

      <h2>Tie-Breaking Rules</h2>
      <p>When multiple enemies are equidistant at maximum range:</p>
      <ul>
        <li><strong>Ally Team Vala:</strong> Prefers the enemy with the lower hex ID</li>
        <li>
          <strong>Enemy Team Vala:</strong> Prefers the enemy with the higher hex ID (180° rotation)
        </li>
      </ul>
    </template>

    <!-- Dunlingr content -->
    <template v-else-if="skillName === 'dunlingr'">
      <p>
        Dunlingr's Bell of Order skill targets an ally character on his team. Depending on which
        mode the Bell is set to, the following effects will apply to all characters on the field
        other than the targeted ally:
      </p>
      <ul>
        <li>Spellbind: Unable to cast Ultimate.</li>
        <li>Curelock: Unable to recover HP for others.</li>
      </ul>

      <h2>How It Works</h2>
      <p>
        Dunlingr automatically identifies and targets a character on his own team that is furthest
        away from his current tile.
      </p>
      <p>
        Distance calculation uses hexagonal grid distance to determine the furthest teammate.
        Dunlingr cannot target himself.
      </p>

      <h2>Tie-Breaking Rules</h2>
      <p>When multiple teammates are equidistant at maximum range:</p>
      <ul>
        <li><strong>Ally Team Dunlingr:</strong> Prefers the ally with the lower hex ID</li>
        <li>
          <strong>Enemy Team Dunlingr:</strong> Prefers the teammate with the higher hex ID (180°
          rotation)
        </li>
      </ul>
    </template>
  </PageContainer>

  <PageContainer v-else maxWidth="800px">
    <h1>Skill Not Found</h1>
    <p>The skill "{{ skillName }}" was not found.</p>
  </PageContainer>
</template>
