<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ShopProbabilityTable from '@/components/guide/shop/ShopProbabilityTable.vue'
import { percent, useShopFigures } from '@/components/guide/shop/useShopFigures'
import { HD_SHOP_PATH } from '@/lib/guide'

const f = useShopFigures()
</script>

<template>
  <h1>Honor Duel Shop Probability</h1>
  <p class="reading-meta">Odds measured by Toto</p>
  <p>
    Every question about the shop, from "will my hero show up?" to "how many badges will this cost
    me?", comes down to a few short formulas. This page walks through them with the odds Toto
    measured over {{ f.records.toLocaleString('en') }} recorded rerolls. The
    <RouterLink :to="HD_SHOP_PATH">shop calculator</RouterLink> does the same sums for the shop in
    front of you.
  </p>

  <h2>Eight cards, eight sources</h2>
  <p>
    A shop shows eight cards. Each card is made by its own source, and a source is a short list of
    products with a chance for each. One source may always make a Random Pack, while another makes a
    hero card most of the time and a piece of equipment the rest.
  </p>
  <ul>
    <li>The eight sources draw on their own. What one makes does not change the others.</li>
    <li>A source is not a place on the screen. Its number is only a label.</li>
    <li>The lists change with the shop level, which rises with the round.</li>
  </ul>
  <ShopProbabilityTable table="levels" />
  <p class="reading-secondary">
    The full list for every source is under "See the odds" on the shop calculator.
  </p>

  <h2>Will a product show up?</h2>
  <p>
    Several sources can make the same product. It is easier to work out the chance that all of them
    miss, and take that away from 1. Write p for a source's chance of making the product:
  </p>
  <p class="formula">
    P(shows) = 1 − (1 − p<sub>1</sub>) × (1 − p<sub>2</sub>) × … × (1 − p<sub>8</sub>)
  </p>
  <p>
    Two sources at 50% each do not add up to a sure thing. Both miss a quarter of the time, so the
    product shows in 75% of shops. This is how often each product shows in a fresh shop:
  </p>
  <ShopProbabilityTable table="products" />

  <h2>Will my hero show up?</h2>
  <p>
    A hero card names one of the shop's {{ f.poolSize.value }} heroes. The game does not show how it
    picks, so every hero is taken as equally likely. A source that makes a hero card with chance p
    then makes a card of your hero with chance p ÷ {{ f.poolSize.value }}, and the same formula
    gives the chance q that a shop shows it:
  </p>
  <p class="formula">
    q = 1 − (1 − p<sub>1</sub> ÷ {{ f.poolSize.value }}) × … × (1 − p<sub>8</sub> ÷
    {{ f.poolSize.value }})
  </p>
  <ShopProbabilityTable table="hero" />

  <h2>How many rerolls will it take?</h2>
  <p>
    Each reroll is a fresh try with the same chance q. The chance of seeing the card at least once
    in r rerolls, and the number of rerolls it takes on average, are:
  </p>
  <p class="formula">P(within r rerolls) = 1 − (1 − q)<sup>r</sup></p>
  <p class="formula">average rerolls = 1 ÷ q</p>
  <p>
    A reroll costs {{ f.reroll }} badges, so the average cost of finding a card and buying it is:
  </p>
  <p class="formula">average badges = {{ f.reroll }} ÷ q + price</p>
  <p>
    At shop level {{ f.example.value.level }}, one hero shows in
    {{ percent(f.example.value.chance) }} of shops. That is
    {{ f.example.value.rerolls.toFixed(1) }} rerolls on average, or about
    {{ Math.round(f.example.value.rerollBadges) }} badges on rerolls and
    {{ Math.round(f.example.value.badges) }} with the {{ f.heroPrice }}-badge card.
  </p>
  <p>
    An average is not a promise. After {{ f.example.value.rounded }} rerolls there is still a
    {{ percent(f.example.value.unlucky) }} chance that the card has not shown once. For a small q
    this share is always close to 37%.
  </p>

  <h2>What a pack gives</h2>
  <p>
    A pack picks {{ f.draws }} heroes from its pool, and it may pick the same hero twice. With k
    wanted heroes in a pool of n, the chance that at least one of d picks is wanted is:
  </p>
  <p class="formula">P(at least one) = 1 − (1 − k ÷ n)<sup>d</sup></p>
  <p>
    A Random Pack picks from all {{ f.poolSize.value }} heroes. A faction pack picks from the
    {{ f.factionPoolSize.value }} of its faction, so the wanted heroes have to belong to it.
  </p>
  <ShopProbabilityTable table="packs" />
  <p>
    Dividing a pack's price by its chance gives the average badges spent before it pays off. For one
    wanted hero that is about {{ Math.round(f.packCost.value.random) }} badges through Random Packs
    at {{ f.randomPrice }} each, and about {{ Math.round(f.packCost.value.faction) }} through
    faction packs at {{ f.factionPrice }}. Selling the heroes you do not need gives
    {{ f.sell }} badges back for each, which lowers both figures a little.
  </p>

  <h2>What a lock changes</h2>
  <p>
    A locked card stays through the next reroll, and so does its source: that source makes nothing
    new while its card is locked. In the formulas above, the product then runs over the unlocked
    sources only.
  </p>
  <ul>
    <li>
      Locking a card from a source that never makes what you want costs nothing. Your chance on the
      next reroll is the same.
    </li>
    <li>
      Locking a card from a source that could have made it lowers your chance, because that source
      sits the reroll out.
    </li>
    <li>
      A bought card leaves an empty place until the next reroll. It is not replaced on the spot.
    </li>
  </ul>
  <p>
    Two sources can make the same product, so a card does not always say which source made it. The
    calculator weighs each possible source by how well it fits the other cards on show.
  </p>

  <h2>Best chance and fewest badges</h2>
  <p>
    The calculator answers two different questions, and both rest on one rule: the value of a move
    is the value of each thing that can follow it, weighted by its chance.
  </p>
  <p><b>Best chance</b> asks how likely you are to finish this round with the badges in hand.</p>
  <p class="formula">chance = the best move's sum of P(outcome) × chance after it</p>
  <p><b>Fewest badges</b> asks what the goal costs on average if you could keep rerolling.</p>
  <p class="formula">cost = the cheapest move's price + sum of P(outcome) × cost after it</p>
  <p>
    With no locks and one card to find, the second rule shrinks to the formula above,
    {{ f.reroll }} ÷ q + price. The two answers can disagree. Buying a single card now may be the
    best chance this round, while saving the badges for a later shop costs less on average.
  </p>

  <h2>Where the odds come from</h2>
  <p>
    Nobody outside the game sees the sources. Toto recorded shops reroll by reroll and worked the
    lists out from them.
  </p>
  <ul>
    <li>
      If each card named its source, the estimate would be a simple count: the times a source made a
      product, divided by the times it drew.
    </li>
    <li>
      The sources are hidden, so the estimate is the set of lists under which the recorded shops are
      most likely. The chance of one recorded shop is the sum, over every way the eight sources
      could have made it, of the chances multiplied together.
    </li>
    <li>
      The range beside a measured figure is its 95% range. It comes from drawing the records again
      at random many times and repeating the estimate.
    </li>
  </ul>
  <p>Three limits are worth knowing:</p>
  <ul>
    <li>A measured 100% is not proof that the game guarantees it.</li>
    <li>
      The records do not tell the four faction packs apart, so they are taken as equally likely.
    </li>
    <li>Heroes in a pool, and pieces of one equipment tier, are taken as equally likely too.</li>
  </ul>
</template>
