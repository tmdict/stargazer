<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ShopProbabilityTable from '@/components/guide/shop/ShopProbabilityTable.vue'
import { percent, useShopFigures } from '@/components/guide/shop/useShopFigures'
import { HD_SHOP_PATH } from '@/lib/guide'

const f = useShopFigures()
</script>

<template>
  <h1>荣誉对决商店概率</h1>
  <p class="reading-meta">概率由 Toto 实测</p>
  <p>
    关于商店的每个问题，从“我要的英雄会不会出现”到“这要花多少徽章”，都可以用几条简短的公式回答。本页用
    Toto 在 {{ f.records.toLocaleString('en') }} 次刷新记录中实测的概率逐一说明。<RouterLink
      :to="HD_SHOP_PATH"
      >商店计算器</RouterLink
    >会针对你眼前的商店做同样的计算。
  </p>

  <h2>八张卡片，八个来源</h2>
  <p>
    商店展示八张卡片。每张卡片各有自己的来源，一个来源就是一份商品清单，每种商品各有概率。有的来源必定产出随机卡包，有的来源多数时候产出英雄卡，其余时候产出装备。
  </p>
  <ul>
    <li>八个来源各自独立抽取，互不影响。</li>
    <li>来源不对应屏幕上的位置，编号只是标记。</li>
    <li>清单随商店等级变化，商店等级随回合提升。</li>
  </ul>
  <ShopProbabilityTable table="levels" />
  <p class="reading-secondary">每个来源的完整清单见商店计算器的“查看概率”。</p>

  <h2>某种商品会出现吗？</h2>
  <p>
    同一种商品可能来自多个来源。先算出所有来源都没有产出它的概率，再用 1 减去，会更容易。设 p
    为某个来源产出该商品的概率：
  </p>
  <p class="formula">
    P(出现) = 1 − (1 − p<sub>1</sub>) × (1 − p<sub>2</sub>) × … × (1 − p<sub>8</sub>)
  </p>
  <p>
    两个各 50% 的来源加起来并不是必定出现。两者同时落空的概率是四分之一，所以该商品在 75%
    的商店中出现。下表是每种商品在一次新商店中出现的概率：
  </p>
  <ShopProbabilityTable table="products" />

  <h2>我要的英雄会出现吗？</h2>
  <p>
    一张英雄卡是商店
    {{
      f.poolSize.value
    }}
    位英雄中的一位。游戏没有说明抽取方式，因此视每位英雄的概率相等。一个以概率 p
    产出英雄卡的来源，产出你要的英雄的概率就是 p ÷
    {{ f.poolSize.value }}，套用同一条公式即可得到商店出现该英雄的概率 q：
  </p>
  <p class="formula">
    q = 1 − (1 − p<sub>1</sub> ÷ {{ f.poolSize.value }}) × … × (1 − p<sub>8</sub> ÷
    {{ f.poolSize.value }})
  </p>
  <ShopProbabilityTable table="hero" />

  <h2>要刷新多少次？</h2>
  <p>
    每次刷新都是一次概率同为 q 的新尝试。r 次刷新内至少出现一次的概率，以及平均所需的刷新次数为：
  </p>
  <p class="formula">P(r 次刷新内出现) = 1 − (1 − q)<sup>r</sup></p>
  <p class="formula">平均刷新次数 = 1 ÷ q</p>
  <p>一次刷新花费 {{ f.reroll }} 枚徽章，所以找到并买下一张卡片的平均花费为：</p>
  <p class="formula">平均徽章数 = {{ f.reroll }} ÷ q + 价格</p>
  <p>
    在商店等级 {{ f.example.value.level }}，某位英雄在
    {{ percent(f.example.value.chance) }} 的商店中出现。平均需要刷新
    {{ f.example.value.rerolls.toFixed(1) }} 次，刷新约花费
    {{ Math.round(f.example.value.rerollBadges) }} 枚徽章，加上 {{ f.heroPrice }} 枚徽章的英雄卡共约
    {{ Math.round(f.example.value.badges) }} 枚。
  </p>
  <p>
    平均值不是保证。刷新 {{ f.example.value.rounded }} 次后，仍有
    {{ percent(f.example.value.unlucky) }} 的概率一次都没有出现。q 很小时，这个比例总是接近 37%。
  </p>

  <h2>卡包能给什么</h2>
  <p>
    卡包从自己的英雄池中抽取 {{ f.draws }} 位英雄，可能重复抽到同一位。池中有 n 位英雄，其中 k
    位是你想要的，抽 d 次至少抽中一位的概率为：
  </p>
  <p class="formula">P(至少一位) = 1 − (1 − k ÷ n)<sup>d</sup></p>
  <p>
    随机卡包从全部 {{ f.poolSize.value }} 位英雄中抽取。阵营卡包只从该阵营的
    {{ f.factionPoolSize.value }} 位英雄中抽取，所以想要的英雄必须属于这个阵营。
  </p>
  <ShopProbabilityTable table="packs" />
  <p>
    用卡包的价格除以概率，就是抽中之前平均要花的徽章。想要一位英雄时，通过每个
    {{ f.randomPrice }} 枚徽章的随机卡包约需 {{ Math.round(f.packCost.value.random) }} 枚，通过每个
    {{ f.factionPrice }} 枚徽章的阵营卡包约需
    {{ Math.round(f.packCost.value.faction) }} 枚。出售不需要的英雄每位可拿回
    {{ f.sell }} 枚徽章，两个数字都会略低一些。
  </p>

  <h2>锁定会改变什么</h2>
  <p>
    锁定的卡片会保留到下一次刷新，它的来源也一样：卡片锁定期间，这个来源不会产出新的商品。上面的公式中，连乘就只包含未锁定的来源。
  </p>
  <ul>
    <li>锁定一张来自“从不产出你想要的商品”的来源的卡片，没有任何代价，下一次刷新的概率不变。</li>
    <li>锁定一张来自“可能产出它”的来源的卡片，会降低概率，因为这个来源不参与这次刷新。</li>
    <li>买下的卡片会留下空位，直到下一次刷新，不会立刻补上。</li>
  </ul>
  <p>
    两个来源可能产出同一种商品，所以一张卡片不一定能说明它来自哪个来源。计算器会根据同时出现的其他卡片，衡量每个可能的来源。
  </p>

  <h2>最高概率与最少徽章</h2>
  <p>
    计算器回答两个不同的问题，两者都基于同一条规则：一步的价值，等于它之后每种可能结果的价值，按各自的概率加权。
  </p>
  <p><b>最高概率</b>问的是：用手上的徽章，本回合达成目标的概率有多大。</p>
  <p class="formula">概率 = 最优一步的 P(结果) × 之后的概率 之和</p>
  <p><b>最少徽章</b>问的是：如果可以一直刷新，达成目标平均要花多少徽章。</p>
  <p class="formula">花费 = 最省一步的价格 + P(结果) × 之后的花费 之和</p>
  <p>
    没有锁定且只找一张卡片时，第二条规则就简化为上面的公式：{{ f.reroll }} ÷ q +
    价格。两个答案可能不同。现在买下一张单卡也许是本回合概率最高的一步，而把徽章留到之后的商店平均花费更少。
  </p>

  <h2>概率从何而来</h2>
  <p>游戏之外没有人能看到来源。Toto 逐次记录了刷新出的商店，并据此推算出各来源的清单。</p>
  <ul>
    <li>
      如果每张卡片都标明来源，估计值就是简单的计数：某来源产出某商品的次数，除以它抽取的次数。
    </li>
    <li>
      来源是隐藏的，所以估计值是让记录到的商店最有可能出现的那组清单。一次记录到的商店的概率，是八个来源产出它的每种方式的概率相乘后再相加。
    </li>
    <li>实测数值旁的范围是 95% 的范围，通过多次随机重抽记录并重复估计得出。</li>
  </ul>
  <p>有三点局限值得了解：</p>
  <ul>
    <li>实测的 100% 并不证明游戏保证如此。</li>
    <li>记录没有区分四种阵营卡包，因此视四者的概率相等。</li>
    <li>同一池中的英雄、同一品质的装备，也视为概率相等。</li>
  </ul>
</template>
