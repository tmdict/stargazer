<template>
  <article>
    <h1>Vala · Notice Beforehand</h1>
    <p>
      Vala's Notice Beforehand skill targets the enemy furthest from her current position at the
      start of the battle. During battle Vala will attacks the Noticed enemy in priority, and absorb
      energy for each hit.
    </p>

    <h2>How It Works</h2>
    <p>
      Vala automatically identifies and targets an opposing team's character that is furthest away
      from her current tile.
    </p>
    <p>Distance calculation uses hexagonal grid distance to determine the furthest enemy.</p>

    <h2>Tie-Breaking Rules</h2>
    <p>When multiple enemies have the same distance:</p>
    <ul>
      <li><strong>Ally Team Vala:</strong> Prefers the enemy with the lower hex ID</li>
      <li>
        <strong>Enemy Team Vala:</strong> Prefers the enemy with the higher hex ID (180° rotation)
      </li>
    </ul>
  </article>
</template>
