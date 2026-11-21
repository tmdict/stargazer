<script setup lang="ts">
import ShopHowToFigure from '@/components/guide/shop/ShopHowToFigure.vue'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
</script>

<template>
  <article>
    <h1>How to use the Shop Calculator</h1>
    <p>
      Enter the shop you see in the game and what you want from it. The calculator tells you what to
      do first.
    </p>

    <h2>Enter your shop</h2>
    <ol>
      <li>Pick the <b>Shop level</b> and type in your <b>Badges</b>.</li>
      <li>
        Turn on <b>Levels up next round</b> if the shop goes up a level next round. Some levels
        always go up after one round and the last level never does, so there the switch is set for
        you.
      </li>
      <li>
        Press each of the eight cards and pick what it shows. For a hero or a piece of equipment,
        pick which one, or press <b>Not one I want</b> if it isn't one you're after.
      </li>
      <li>
        Press the lock on every card you've locked in the game. For a card you've already bought
        this round, open it and pick <b>Bought</b>.
      </li>
      <li>
        Under <b>Looking for</b>, add the heroes and equipment you want. For each hero, set how many
        more copies you need.
      </li>
      <li>Press <b>Calculate</b>.</li>
    </ol>
    <p>
      A locked card shows a shop level when a lower level sells it too. If you locked it back then,
      press the level and pick the one you locked it at.
    </p>
    <p>
      If the shop you entered can't come up at that level, the cards that don't fit get a red frame
      and a line under them says why. Check those cards and the shop level.
    </p>
    <p>
      <b>Random</b> fills in an example shop if you just want to try it out, and <b>Clear</b>
      empties all eight cards. Both need a second press.
    </p>

    <h2>Your heroes</h2>
    <p>The button under <b>Your heroes</b> opens two lists.</p>
    <ul>
      <li>
        <b>Heroes to sell</b> are the heroes you'd sell straight away if a pack gave you one. Each
        sells for {{ SHOP_FACTS.sell }} badges, and the calculator counts those badges.
      </li>
      <li>
        <b>Heroes at Mythic</b> are the heroes you already have at Mythic. The shop and its packs
        stop giving them, so every other hero turns up a little more often.
      </li>
    </ul>
    <p>
      You don't need to enter how many copies of each hero you own. For the heroes you want, only
      the copies you still need matter. For every other hero, only these two lists change the
      answers.
    </p>

    <h2>Reading an answer</h2>
    <p>
      You get one answer card for each hero or piece you're looking for, worked out as if it were
      your only target. When you look for more than one thing, extra cards such as
      <b>Any target</b> show your odds of getting any one of them. The ones that include heroes only
      show up when every hero needs just one more copy.
    </p>
    <ShopHowToFigure example="move">
      <ol>
        <li>The target, and how many more copies you need.</li>
        <li>
          <b>Best chance</b> is how likely you are to have the target by the end of this round,
          spending only the badges you have now.
        </li>
        <li>
          What to do, from left to right. A move is either one purchase, or a reroll after the lock
          changes it lists.
        </li>
        <li>
          Other moves the calculator compared, with their numbers.
          <b>Rerolling as it stands</b> rerolls with your locks as they are.
          <b>Buying only what is on show</b> never rerolls. <b>Next cheapest</b> is the cheapest
          move after the one above. When you look for several things,
          <b>Keeping your other locks</b> is the best move that leaves the locks for your other
          targets alone.
        </li>
        <li>
          <b>Recalculate with best</b> works the answers out again starting from that move. For a
          reroll, it sets those locks on your shop first.
        </li>
        <li>
          <b>Fewest badges</b> is how many badges the target costs on average if you keep at it,
          round after round, until you get it. It shows which move gives you the most for your
          badges. It's an average, so with bad luck you'll spend more.
        </li>
      </ol>
    </ShopHowToFigure>
    <p>
      A chance shown as a range, such as 30.1% – 31.4%, is still being worked out. It narrows over
      the next few seconds.
    </p>

    <h2>When it says to stop</h2>
    <p>
      Sometimes the calculator says to stop for this round and keep your badges. Waiting costs
      nothing extra, because the first shop of every round redraws all unlocked cards for free.
    </p>
    <ShopHowToFigure example="stop">
      <ol>
        <li>
          In place of a number, <b>Fewest badges</b> tells you why to stop. It does that when
          <ul>
            <li>you can't afford its cheapest move,</li>
            <li>that move leaves you no chance of finishing this round, or</li>
            <li>the shop levels up next round and waiting for the new shop costs less.</li>
          </ul>
        </li>
        <li>
          <b>Stop for this round</b> lists what to buy or lock before you end the round. It always
          ends with <b>Wait for the next round</b>.
        </li>
        <li>
          What the target should cost on average from the next round on, if you follow the plan.
        </li>
      </ol>
    </ShopHowToFigure>
    <p>
      If <b>Best chance</b> says to stop, your badges can't get the target this round however you
      spend them.
    </p>

    <h2>Which answer to follow</h2>
    <p>
      When both answers name the same move, make it. When they differ, <b>Best chance</b> spends
      what it takes to get the target this round, and <b>Fewest badges</b> keeps more badges for
      later rounds. If you need the target now, go with Best chance. If it can wait, go with Fewest
      badges, and stop when it tells you to.
    </p>

    <h2>After each move</h2>
    <p>
      Make the move in the game, then update the cards and your badges here and press
      <b>Calculate</b> again. When you buy a copy of a hero you want, lower its copies too. Marking
      the card <b>Bought</b> doesn't do that for you.
    </p>
  </article>
</template>
