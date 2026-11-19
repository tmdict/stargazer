<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ShopProbabilityTable from '@/components/guide/shop/ShopProbabilityTable.vue'
import { amount, percent, useShopFigures } from '@/components/guide/shop/useShopFigures'
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
  <p>
    The cards on sale are hero cards with one copy or two, packs of {{ f.draws }} heroes picked from
    every hero or from one faction, equipment, Artifact XP, Trial Cards and the Random Legendary
    Hero. A two-copy card holds two copies of the same hero. A reroll costs {{ f.reroll }} badges.
  </p>
  <p class="reading-secondary">
    The full list for every source is under "See the odds" on the shop calculator.
  </p>

  <h2>Rounds, badges and shop level</h2>
  <p>
    Every round brings badges, and the shop level rises with the round. The level decides what the
    sources can make, and the badges decide how many rerolls and cards a round can pay for.
  </p>
  <ShopProbabilityTable table="rounds" />

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
    product shows in 75% of shops. This is each product's price in badges and how often it shows in
    a fresh shop:
  </p>
  <ShopProbabilityTable table="products" />

  <h2>Will my hero show up?</h2>
  <p>
    A hero card names one of the shop's {{ f.poolSize }} heroes. The game does not show how it
    picks, so every hero is taken as equally likely. A source that makes a hero card with chance p
    then makes a card of your hero with chance p ÷ {{ f.poolSize }}, and the same formula gives the
    chance q that a shop shows it:
  </p>
  <p class="formula">
    q = 1 − (1 − p<sub>1</sub> ÷ {{ f.poolSize }}) × … × (1 − p<sub>8</sub> ÷ {{ f.poolSize }})
  </p>
  <p>
    From shop level {{ f.pairFrom }} a hero can also show on a two-copy card. The table counts the
    two cards apart, and then together.
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
    At shop level {{ f.example.level }}, one hero shows in {{ percent(f.example.chance) }} of shops.
    That is {{ f.example.rerolls.toFixed(1) }} rerolls on average, or about
    {{ Math.round(f.example.rerollBadges) }} badges on rerolls. The price depends on the card: in
    {{ percent(f.example.pairOnly) }} of those shops the hero shows on two-copy cards only, at
    {{ f.pairPrice }} badges in place of {{ f.heroPrice }}. The average price is then about
    {{ Math.round(f.example.price) }} badges, and one copy costs about
    {{ Math.round(f.example.badges) }} badges in all.
  </p>
  <p>
    An average is not a promise. After {{ f.example.rounded }} rerolls there is still a
    {{ percent(f.example.unlucky) }} chance that the card has not shown once. For a small q this
    share is always close to 37%.
  </p>

  <h2>What a pack gives</h2>
  <p>
    A pack picks {{ f.draws }} heroes from its pool, and it may pick the same hero twice. With k
    wanted heroes in a pool of n, the chance that at least one of d picks is wanted is:
  </p>
  <p class="formula">P(at least one) = 1 − (1 − k ÷ n)<sup>d</sup></p>
  <p>
    A Random Pack picks from all {{ f.poolSize }} heroes. A faction pack picks from the
    {{ f.factionPoolSize }} of its faction, so the wanted heroes have to belong to it. A Random
    Legendary Hero picks one hero and gives {{ f.legendaryCopies }} copies of it.
  </p>
  <p>
    A pool is the shop's heroes less the ones you already hold at Mythic, which the shop and its
    packs no longer give. Every hero left in a pool is taken as equally likely.
  </p>
  <ShopProbabilityTable table="packs" />
  <p>
    Dividing a pack's price by its chance gives the average badges spent before it pays off. For one
    wanted hero that is about {{ Math.round(f.packCost.random) }} badges through Random Packs at
    {{ f.randomPrice }} each, and about {{ Math.round(f.packCost.faction) }} through faction packs
    at {{ f.factionPrice }}. Selling the heroes you do not need gives {{ f.sell }} badges back for
    each, which lowers both figures a little.
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
    <li>Unlocking a card lets its source draw again on the next reroll.</li>
  </ul>
  <p>
    Two sources can make the same product, so a card does not always say which source made it. The
    cards on show together help: at shop level 1, one source always makes a Random Pack and another
    makes either that pack or Rare Equipment, so two Random Packs on show came from those two
    sources, one each. Locking one of them keeps its own source out of the next reroll, not a source
    of your choosing. The calculator weighs each possible source by how well it fits the other cards
    on show.
  </p>

  <h2>What a purchase costs</h2>
  <ul>
    <li>
      A purchase has to be paid in full before it is opened. Badges from selling what a pack gives
      come afterwards and cannot help pay for that pack.
    </li>
    <li>
      A hero card sells for {{ f.sell }} badges. On the calculator you name the heroes you would
      sell, and only those are sold when a pack gives them. A pack returns at most
      {{ f.packRefund }} badges, and so does a Random Legendary Hero, whose
      {{ f.legendaryCopies }} copies sell together.
    </li>
    <li>
      When a pack misses, the badges from its sales are added to what is left before the next move
      is chosen. Each thing a pack can give is followed on its own. An average refund is never
      counted in advance.
    </li>
    <li>
      A bought card is gone until a paid reroll draws its place again, so one card cannot be bought
      twice.
    </li>
  </ul>
  <p>
    Take two Random Packs on show at {{ f.randomPrice }} badges each, and no sales. With
    {{ f.randomPrice * 2 - 1 }} badges you can buy one, and with {{ f.randomPrice * 2 }} both.
    Rerolling first costs {{ f.reroll }}, so buying two packs from the next shop, if it shows them,
    takes {{ f.randomPrice * 2 + f.reroll }}. With a single pack on show,
    {{ f.randomPrice * 2 }} badges do not buy two: the first leaves {{ f.randomPrice }}, short of
    the {{ f.reroll + f.randomPrice }} for a reroll and another pack.
  </p>

  <h2>Best chance and fewest badges</h2>
  <p>
    The calculator answers two different questions for each target, and each answer names the move
    to make first. Both rest on one rule: the value of a move is the value of each thing that can
    follow it, weighted by its chance.
  </p>

  <h3>Reading the answers</h3>
  <ul>
    <li>
      Each answer is for one target on its own. Copies of different heroes are never added together.
      "Any wanted hero" and "Any target" mean finishing any one of them.
    </li>
    <li>
      A hero starts at one more copy wanted, and you can raise it. A one-copy card counts as 1, a
      two-copy card as 2 and a Random Legendary Hero as {{ f.legendaryCopies }}, always of one hero.
    </li>
    <li>
      A card marked as bought is not taken off the copies wanted. Enter the copies you still need
      after what you have really bought.
    </li>
    <li>
      Best chance is the chance of holding the target by the end of this round. It is not the chance
      of only seeing it in the next shop.
    </li>
    <li>
      "Buying only what is on show" is the chance with no reroll at all: the best set of purchases
      among the cards entered, several packs included when the badges allow.
    </li>
  </ul>

  <h3>Best chance</h3>
  <p>Best chance asks how likely you are to finish this round with the badges in hand.</p>
  <p class="formula">V(s) = max<sub>a</sub> Σ<sub>o</sub> P(o | s, a) × V(s′)</p>
  <p>
    The state s holds the copies still needed, the badges, the cards on show and what is known about
    their sources. a is a move you can pay for, o is one thing that can come of it, and s′ is the
    state after it. A finished goal is worth 1, and a state with no move left to pay for is worth 0.
    Each result of a purchase or a reroll is followed to its own best next move and weighed by its
    chance. Adding those up is the law of total probability.
  </p>
  <p>
    This is why the sure card is not always the first buy. Buying a one-copy card now can be worse
    than keeping the badges for a two-copy card after a reroll.
  </p>

  <h3>Fewest badges</h3>
  <p>Fewest badges asks what the goal costs on average if you could keep rerolling.</p>
  <p class="formula">E(s) = min<sub>a</sub> [ c(a) + Σ<sub>o</sub> P(o | s, a) × E(s′) ]</p>
  <p>
    E(s) is the average number of badges spent from the state s until the goal. Here the state holds
    the copies still needed, the cards on show and what is known about the sources of locked cards,
    and leaves out the badges in hand. c(a) is what a move costs: {{ f.reroll }} badges for a
    reroll, the price for a purchase. Badges from selling a pack's heroes are taken off result by
    result. Once the goal is reached, E is 0.
  </p>
  <p>
    A reroll with no locks can bring back the very same state, so E(s) stands on both sides of its
    own equation. The answer is the set of values for which every state's equation holds at once.
    With no locks and one card to find, which shows with chance q and costs p, it shrinks to the
    formula above:
  </p>
  <p class="formula">E = {{ f.reroll }} ÷ q + p</p>
  <p>
    A Random Legendary Hero names your hero once in {{ f.poolSize }} times, so one hit costs
    {{ f.legendaryPrice }} × {{ f.poolSize }} =
    {{ (f.legendaryPrice * f.poolSize).toLocaleString('en') }} badges on average. Fewest badges does
    not pick it for a single hero.
  </p>
  <p>
    The two answers can disagree. Buying a single card now may be the best chance this round, while
    saving the badges for a later shop costs less on average. And an average is only that: with bad
    luck the real spending can be much higher.
  </p>

  <h2>When to stop for the round</h2>
  <p>
    Honor Duel runs over several rounds, and the badges you keep are spent in later shops. Best
    chance looks only at this round. Fewest badges looks at the whole way to the goal: with no limit
    on badges every plan gets there in the end, so the plan to prefer is the one that spends the
    fewest on average.
  </p>
  <p>
    That limitless count is only a way to compare choices. In play you have the badges in hand, so
    when the goal can no longer be finished this round, stopping beats spending on. Each round's
    first shop draws the unlocked cards again for free, so stopping shows you a new shop without
    paying for a reroll.
  </p>
  <p>
    The calculator says to stop when its cheapest move cannot be paid for, when that move leaves no
    chance of finishing this round, or when the shop level rises next round and waiting costs less
    by more than a reroll.
  </p>
  <p>
    Whether to lock or buy a card before stopping is judged by the same equation. A lock keeps a
    good card for the next round but keeps its source from drawing again. Buying frees the source,
    but the badges are spent even if a better card shows later. When the shop level rises next
    round, the sources make other things, so a lock or a purchase has to be judged against that
    level's lists.
  </p>
  <p>
    With plenty of badges, best chance and fewest badges usually name the same move. When badges are
    tight they can part: if a pack of {{ f.draws }} heroes is the only way left to finish two copies
    this round, best chance buys it, while fewest badges leaves the costly pack and stops, to look
    for hero cards in later rounds.
  </p>

  <h2>Rules and observations</h2>
  <p>
    A rule is a comparison that holds in every case. When one choice is never worse than another,
    the other need not be looked at. An observation is a comparison with conditions, reached by
    putting average badges or chances side by side. It guides the decision while its conditions hold
    and can turn around when they do not, so it does not replace the calculation.
  </p>

  <h3>Rule 1. If you will buy a locked card anyway, buy it now</h3>
  <p>
    A locked card costs the same now or later, and a bought card's place is drawn again on the next
    reroll, which is one more chance. A lock is better than buying only if you might later give the
    card up and finish for less. What a lock is worth is that option to walk away, and whether it
    outweighs the extra draw is for the calculation to settle.
  </p>

  <h3>Rule 2. If you will buy both a pack and a sure card from one shop, open the pack first</h3>
  <p>
    Within one shop the order of purchases changes no price, and the cards stay until the next
    reroll. Opening the uncertain pack first lets you decide the rest after seeing what it gave. If
    the pack gives the hero, the sure card need not be bought. Opening the pack first is never
    worse.
  </p>

  <h3>Observation 1. If buying cannot overshoot, buy instead of locking</h3>
  <p>
    Hero cards cost {{ f.heroPrice }} badges a copy, with one copy or with two. The usual use of a
    lock is to avoid an overshoot. With two copies still needed, buying a one-copy card means a
    later two-copy card pays for three copies, while with the one-copy card locked you can buy the
    two-copy card and drop the lock.
  </p>
  <p>
    An overshoot happens only when an odd number of copies is left and a two-copy card fills it.
    Buying a two-copy card never changes whether the number left is odd or even, and buying a
    one-copy card when the number left is odd makes it even, which removes the risk. In those cases
    every way of finishing without the card still finishes, at no higher cost, with the card bought,
    so there is no reason to give it up.
  </p>
  <p>
    If a product that gives several copies at once can show, such as the Random Legendary Hero with
    its {{ f.legendaryCopies }}, copies no longer cost the same each and this observation does not
    hold.
  </p>
  <p>
    Take shop level 4, 60 badges, all {{ f.poolSize }} heroes in the pool, three copies needed and a
    two-copy card on show. Buying cannot overshoot, and it gives a 46.8% chance of finishing this
    round. Locking gives 47.6% when the card came from a source that cannot make a Random Legendary
    Hero, since the badges kept can still pay for one, and 46.0% when it came from the source that
    can, since that source makes nothing new while the card is locked. With 75 badges buying leads
    either way.
  </p>

  <h3>
    Observation 2. Needing two copies, lock a one-copy card when badges are tight and buy it when
    they are plenty
  </h3>
  <p>
    This is where the overshoot matters most. Take B badges and a one-copy card on show. With the
    card locked, finishing costs {{ f.pairPrice }} badges either way: another one-copy card plus the
    locked one, or a two-copy card with the lock dropped. That leaves (B − {{ f.pairPrice }}) ÷
    {{ f.reroll }} rerolls.
  </p>
  <p>
    With the card bought at once, the same number of rerolls is left when the last copy comes on a
    one-copy card, but (B − {{ f.heroPrice + f.pairPrice }}) ÷ {{ f.reroll }}, which is
    {{ amount(f.heroPrice / f.reroll) }} fewer, when it comes on a two-copy card. In return the
    bought card's place is drawn again on every reroll. With few badges those
    {{ amount(f.heroPrice / f.reroll) }} rerolls are a large share of all you have and locking is
    better. With many, the goal is usually reached before they matter and the extra draw is worth
    more.
  </p>
  <p>
    Toto's calculator puts the boundary at about 60 badges at shop level {{ f.levels.length }} with
    all {{ f.poolSize }} heroes in the pool: locking is better below it and buying above, and near
    it the two differ by less than 1 percentage point. At the levels below, where two-copy cards are
    rare, buying is better even with few badges. This compares the chance of finishing this round.
    It does not count the worth of holding the bought card when the round ends short.
  </p>
  <p>
    With two copies needed, a one-copy card on show and all {{ f.poolSize }} heroes in the pool,
    Toto's calculator gives these chances of finishing this round:
  </p>
  <ShopProbabilityTable table="lock-or-buy" />
  <p>The other cards on show move these a little.</p>

  <h3>Observation 3. If one copy is needed and the hero's two-copy card shows, buy it</h3>
  <p>
    For fewest badges, the other choice is to lock the two-copy card ({{ f.pairPrice }} badges) and
    reroll until the {{ f.heroPrice }}-badge card shows. If a reroll shows that card with chance p,
    it takes about 1 ÷ p rerolls, so waiting costs more on average whenever:
  </p>
  <p class="formula">
    {{ f.heroPrice }} + {{ f.reroll }} ÷ p ≥ {{ f.pairPrice }}, that is, p ≤
    {{ percent(f.pairBreakEven) }}
  </p>
  <p>
    Every reroll meets the same choice, so trying a few rerolls first cannot beat the better of the
    two. By observation 4, packs do not change the comparison. At the shop levels where two-copy
    cards show, p is between {{ percent(f.pairSingle.low) }} and
    {{ percent(f.pairSingle.high) }} with all {{ f.poolSize }} heroes in the pool, so buying at once
    is better. p passes {{ percent(f.pairBreakEven) }} only in a smaller pool, of
    {{ f.pairPool.low }} to {{ f.pairPool.high }} heroes or fewer depending on the shop level, for
    example once many heroes are at Mythic. Rerolling is then better. For best chance, buying
    finishes the goal on the spot, so you buy.
  </p>

  <h3>Observation 4. For one hero, a one-copy card beats a Random Pack or a faction pack</h3>
  <p>
    A one-copy card gives a wanted copy for certain at {{ f.heroPrice }} badges. A pack picks
    {{ f.draws }} heroes from its pool with repeats, so with n heroes in the pool, k of them wanted,
    it gives {{ f.draws }} × k ÷ n wanted copies on average. With c for the pack's price, a copy
    through the pack costs at least as much as the card whenever:
  </p>
  <p class="formula">
    c × n ÷ ({{ f.draws }} × k) ≥ {{ f.heroPrice }}, that is, k ÷ n ≤ c ÷
    {{ f.draws * f.heroPrice }}
  </p>
  <p>
    With one wanted hero, a copy costs {{ amount(f.randomPrice / f.draws) }} × n badges through
    Random Packs and {{ amount(f.factionPrice / f.draws) }} × m through packs of a faction with m
    heroes. With {{ f.poolSize }} heroes in the pool and {{ f.factionPoolSize }} in the faction that
    is {{ Math.round(f.copyCost.random) }} and {{ Math.round(f.copyCost.faction) }} badges, far
    above the card's {{ f.heroPrice }}. A pack beats one-copy cards only when wanted heroes make up
    a large share of its pool: more than {{ percent(f.packShare.random) }} of the pool for a Random
    Pack and more than {{ percent(f.packShare.faction) }} of the faction for a faction pack. Selling
    everything a pack gives returns at most {{ f.packRefund }} badges, so with one wanted hero the
    answer stays the same.
  </p>

  <h3>Observation 5. For one hero, a faction pack beats a Random Pack</h3>
  <p>
    By the pack formula, a pack gives the hero with chance 1 − (1 − 1 ÷ n)<sup>{{ f.draws }}</sup
    >. Buying the same pack until it hits costs its price divided by that chance. With m heroes in
    the hero's faction and n in the whole pool, the two packs compare as:
  </p>
  <p class="formula">
    {{ f.factionPrice }} ÷ (1 − (1 − 1 ÷ m)<sup>{{ f.draws }}</sup
    >) against {{ f.randomPrice }} ÷ (1 − (1 − 1 ÷ n)<sup>{{ f.draws }}</sup
    >)
  </p>
  <p>
    With {{ f.factionPoolSize }} heroes in the faction and {{ f.poolSize }} in the pool, the faction
    pack costs about {{ Math.round(f.packCost.faction) }} badges and the Random Pack about
    {{ Math.round(f.packCost.random) }}. For small chances the chance is close to {{ f.draws }} ÷ x,
    so the comparison is roughly {{ amount(f.factionPrice / f.draws) }} × m against
    {{ amount(f.randomPrice / f.draws) }} × n. The two meet where the whole pool is about
    {{ amount(f.packRatio) }} times the size of the hero's faction: about
    {{ Math.round(f.packPool) }} heroes for a faction of {{ f.factionPoolSize }}.
  </p>
  <p>
    While the {{ f.factions }} factions keep similar numbers, the faction pack is always better. If
    many heroes of the other factions have left the pool, for example at Mythic, and it falls under
    that size, the Random Pack is better. When any of several wanted heroes of different factions
    will do, the Random Pack hits more often, so compare the two packs directly.
  </p>
  <p class="reading-secondary">
    A rule holds in every case and can always be used. Use an observation only when the conditions
    in its reasoning hold: the pool size, the number of wanted heroes, whether a product that gives
    several copies can show. Otherwise the decision has to be calculated.
  </p>

  <h2>Where the odds come from</h2>
  <p>
    Nobody outside the game sees the sources. Toto recorded shops reroll by reroll and worked the
    lists out from them. The method is maximum likelihood estimation: choose the chances under which
    the recorded shops are most likely.
  </p>
  <p>
    If each card named its source, the estimate would be a simple count. Over N draws from one
    source, with product k drawn n<sub>k</sub> times:
  </p>
  <p class="formula">p<sub>k</sub> ≈ n<sub>k</sub> ÷ N</p>
  <p>
    The sources are hidden, so dividing a product's total by eight times the rerolls gives only a
    pooled frequency, not each source's list. The records hold more than totals: which products show
    together, and how many of each one shop shows. For shops with no locks at one shop level, write
    c for a shop's count of each product and n<sub>c</sub> for the number of recorded shops with
    that count. The estimate is the set of lists θ that makes this sum largest:
  </p>
  <p class="formula">Σ<sub>c</sub> n<sub>c</sub> × log P<sub>θ</sub>(c)</p>
  <p>
    With the sources drawing on their own, the chance of a count c adds up every way the eight
    sources could have made it. A(c) is the set of those ways, and p<sub>j,z</sub> the chance that
    source j makes the product z it is handed in one of them:
  </p>
  <p class="formula">
    P<sub>θ</sub>(c) = Σ<sub>z ∈ A(c)</sub> p<sub>1,z<sub>1</sub></sub> × p<sub
      >2,z<sub>2</sub></sub
    >
    × … × p<sub>8,z<sub>8</sub></sub>
  </p>
  <p>Every chance is 0 or more, and the chances of one source add up to 1.</p>
  <ul>
    <li>
      A kept card is not a fresh draw. A record counts only the newly drawn cards, read against the
      locks set just before the reroll and the sources those locked cards may hold. A lock added
      after the reroll belongs to the next one. Counting kept cards as fresh draws would skew the
      estimate.
    </li>
    <li>
      The range beside a measured figure is its 95% range. It comes from drawing the records again
      at random, with repeats, and repeating the estimate many times.
    </li>
    <li>
      Which products each source can make at all is worked out from the records too. The ranges hold
      that fixed and show only how far the chances may be off.
    </li>
  </ul>
  <ShopProbabilityTable table="levels" />
  <p>Four limits are worth knowing:</p>
  <ul>
    <li>A measured 100% is not proof that the game guarantees it.</li>
    <li>
      Different sets of lists can fit the same records about equally well, and the source numbers
      can be swapped around without changing anything.
    </li>
    <li>
      The records do not tell the {{ f.factions }} faction packs apart, so they are taken as equally
      likely.
    </li>
    <li>Heroes in a pool, and pieces of one equipment tier, are taken as equally likely too.</li>
  </ul>
</template>
