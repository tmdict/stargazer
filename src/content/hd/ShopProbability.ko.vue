<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ShopProbabilityTable from '@/components/guide/shop/ShopProbabilityTable.vue'
import { percent, useShopFigures } from '@/components/guide/shop/useShopFigures'
import { HD_SHOP_PATH } from '@/lib/guide'

const f = useShopFigures()
</script>

<template>
  <h1>명예의 결투 상점 확률</h1>
  <p class="reading-meta">확률 측정: Toto</p>
  <p>
    "원하는 영웅이 나올까?"부터 "휘장이 얼마나 들까?"까지, 상점에 관한 질문은 모두 짧은 공식 몇 개로
    답할 수 있습니다. 이 페이지는 Toto가 새로고침 {{ f.records.toLocaleString('en') }}회를 기록해
    측정한 확률로 그 공식을 하나씩 설명합니다.
    <RouterLink :to="HD_SHOP_PATH">상점 계산기</RouterLink>는 지금 보이는 상점에 대해 같은 계산을 해
    줍니다.
  </p>

  <h2>카드 여덟 장, 출처 여덟 개</h2>
  <p>
    상점에는 카드 여덟 장이 나옵니다. 카드마다 자기 출처가 있고, 출처는 상품마다 확률이 정해진 짧은
    목록입니다. 어떤 출처는 항상 무작위 팩을 내고, 어떤 출처는 대부분 영웅 카드를 내고 나머지는
    장비를 냅니다.
  </p>
  <ul>
    <li>
      여덟 출처는 서로 독립적으로 뽑습니다. 한 출처의 결과가 다른 출처에 영향을 주지 않습니다.
    </li>
    <li>출처는 화면의 위치가 아닙니다. 번호는 구분을 위한 이름일 뿐입니다.</li>
    <li>목록은 상점 레벨에 따라 달라지고, 상점 레벨은 라운드가 지나면 오릅니다.</li>
  </ul>
  <ShopProbabilityTable table="levels" />
  <p class="reading-secondary">출처별 전체 목록은 상점 계산기의 "확률 보기"에 있습니다.</p>

  <h2>상품이 나올까?</h2>
  <p>
    같은 상품을 여러 출처가 낼 수 있습니다. 모든 출처가 그 상품을 내지 않을 확률을 구해 1에서 빼는
    편이 쉽습니다. 한 출처가 그 상품을 낼 확률을 p라고 하면:
  </p>
  <p class="formula">
    P(등장) = 1 − (1 − p<sub>1</sub>) × (1 − p<sub>2</sub>) × … × (1 − p<sub>8</sub>)
  </p>
  <p>
    50%인 출처가 둘이라고 반드시 나오는 것은 아닙니다. 둘 다 빗나갈 확률이 4분의 1이므로 그 상품은
    상점의 75%에서 나옵니다. 아래는 새 상점에 각 상품이 나올 확률입니다.
  </p>
  <ShopProbabilityTable table="products" />

  <h2>원하는 영웅이 나올까?</h2>
  <p>
    영웅 카드는 상점의 영웅 {{ f.poolSize.value }}명 중 한 명입니다. 게임은 뽑는 방식을 알려 주지
    않으므로 모든 영웅의 확률이 같다고 봅니다. 확률 p로 영웅 카드를 내는 출처가 원하는 영웅의 카드를
    낼 확률은 p ÷ {{ f.poolSize.value }}이고, 같은 공식으로 상점에 그 영웅이 나올 확률 q를 구합니다.
  </p>
  <p class="formula">
    q = 1 − (1 − p<sub>1</sub> ÷ {{ f.poolSize.value }}) × … × (1 − p<sub>8</sub> ÷
    {{ f.poolSize.value }})
  </p>
  <ShopProbabilityTable table="hero" />

  <h2>새로고침을 몇 번 해야 할까?</h2>
  <p>
    새로고침은 매번 같은 확률 q의 새로운 시도입니다. 새로고침 r회 안에 한 번 이상 나올 확률과 평균
    새로고침 횟수는 다음과 같습니다.
  </p>
  <p class="formula">P(r회 안에 등장) = 1 − (1 − q)<sup>r</sup></p>
  <p class="formula">평균 새로고침 = 1 ÷ q</p>
  <p>새로고침 한 번에 휘장 {{ f.reroll }}개가 들므로, 카드를 찾아서 사는 데 드는 평균 비용은:</p>
  <p class="formula">평균 휘장 = {{ f.reroll }} ÷ q + 가격</p>
  <p>
    상점 레벨 {{ f.example.value.level }}에서 영웅 한 명은 상점의
    {{ percent(f.example.value.chance) }}에서 나옵니다. 평균
    {{ f.example.value.rerolls.toFixed(1) }}회의 새로고침, 즉 새로고침에 휘장 약
    {{ Math.round(f.example.value.rerollBadges) }}개가 들고, 휘장 {{ f.heroPrice }}개인 카드까지
    사면 약 {{ Math.round(f.example.value.badges) }}개입니다.
  </p>
  <p>
    평균은 보장이 아닙니다. 새로고침을 {{ f.example.value.rounded }}회 해도 카드가 한 번도 나오지
    않을 확률이 {{ percent(f.example.value.unlucky) }} 남아 있습니다. q가 작으면 이 비율은 항상
    37%에 가깝습니다.
  </p>

  <h2>팩에서 나오는 것</h2>
  <p>
    팩은 자기 영웅 풀에서 영웅 {{ f.draws }}명을 뽑고, 같은 영웅을 두 번 뽑을 수도 있습니다. 풀의
    영웅이 n명, 그중 원하는 영웅이 k명일 때 d번 뽑아 한 명 이상 나올 확률은:
  </p>
  <p class="formula">P(한 명 이상) = 1 − (1 − k ÷ n)<sup>d</sup></p>
  <p>
    무작위 팩은 영웅 {{ f.poolSize.value }}명 전체에서 뽑습니다. 진영 팩은 그 진영의
    {{ f.factionPoolSize.value }}명에서만 뽑으므로, 원하는 영웅이 그 진영이어야 합니다.
  </p>
  <ShopProbabilityTable table="packs" />
  <p>
    팩의 가격을 확률로 나누면 원하는 영웅이 나올 때까지 평균적으로 쓰는 휘장이 됩니다. 영웅 한 명을
    원할 때 휘장 {{ f.randomPrice }}개인 무작위 팩으로는 약
    {{ Math.round(f.packCost.value.random) }}개, 휘장 {{ f.factionPrice }}개인 진영 팩으로는 약
    {{ Math.round(f.packCost.value.faction) }}개입니다. 필요 없는 영웅을 팔면 한 명당 휘장
    {{ f.sell }}개를 돌려받아 두 수치가 조금 낮아집니다.
  </p>

  <h2>잠금이 바꾸는 것</h2>
  <p>
    잠근 카드는 다음 새로고침에도 남고, 그 출처도 함께 남습니다. 카드가 잠겨 있는 동안 그 출처는 새
    상품을 내지 않습니다. 위 공식에서 곱은 잠기지 않은 출처만 포함합니다.
  </p>
  <ul>
    <li>
      원하는 상품을 전혀 내지 않는 출처의 카드를 잠그면 손해가 없습니다. 다음 새로고침의 확률은
      그대로입니다.
    </li>
    <li>
      원하는 상품을 낼 수 있는 출처의 카드를 잠그면 확률이 낮아집니다. 그 출처가 새로고침에서 빠지기
      때문입니다.
    </li>
    <li>구매한 카드의 자리는 다음 새로고침까지 비어 있습니다. 바로 채워지지 않습니다.</li>
  </ul>
  <p>
    두 출처가 같은 상품을 낼 수 있으므로 카드만 보고 출처를 항상 알 수는 없습니다. 계산기는 함께
    나온 다른 카드에 얼마나 맞는지에 따라 가능한 출처마다 가중치를 둡니다.
  </p>

  <h2>최고 확률과 최소 휘장</h2>
  <p>
    계산기는 서로 다른 두 질문에 답하며, 둘 다 하나의 규칙을 따릅니다. 한 수의 가치는 그 뒤에 올 수
    있는 각 결과의 가치를 확률로 가중한 값입니다.
  </p>
  <p><b>최고 확률</b>은 가진 휘장으로 이번 라운드에 목표를 이룰 확률을 묻습니다.</p>
  <p class="formula">확률 = 가장 좋은 수의 P(결과) × 그 뒤의 확률의 합</p>
  <p><b>최소 휘장</b>은 계속 새로고침할 수 있다면 목표에 평균 얼마가 드는지 묻습니다.</p>
  <p class="formula">비용 = 가장 싼 수의 가격 + P(결과) × 그 뒤의 비용의 합</p>
  <p>
    잠금이 없고 카드 한 장만 찾는 경우 두 번째 규칙은 위의 공식 {{ f.reroll }} ÷ q + 가격이 됩니다.
    두 답은 다를 수 있습니다. 지금 카드 한 장을 사는 것이 이번 라운드의 최고 확률이어도, 휘장을 아껴
    다음 상점에서 쓰는 편이 평균 비용은 더 적을 수 있습니다.
  </p>

  <h2>확률의 출처</h2>
  <p>
    게임 밖에서는 아무도 출처를 볼 수 없습니다. Toto가 새로고침마다 상점을 기록하고 그 기록에서
    목록을 추정했습니다.
  </p>
  <ul>
    <li>
      카드마다 출처가 표시된다면 추정은 단순한 계산입니다. 한 출처가 어떤 상품을 낸 횟수를 그 출처가
      뽑은 횟수로 나누면 됩니다.
    </li>
    <li>
      출처는 숨겨져 있으므로, 기록된 상점들이 나올 가능성이 가장 높아지는 목록을 추정값으로
      삼습니다. 기록된 상점 하나의 확률은 여덟 출처가 그 상점을 만들 수 있는 모든 경우에 대해 확률을
      곱한 값을 더한 것입니다.
    </li>
    <li>
      측정값 옆의 범위는 95% 범위입니다. 기록을 무작위로 다시 뽑아 추정을 여러 번 반복해 얻습니다.
    </li>
  </ul>
  <p>알아 둘 한계가 세 가지 있습니다.</p>
  <ul>
    <li>측정값 100%가 게임이 그것을 보장한다는 증거는 아닙니다.</li>
    <li>기록에서는 네 가지 진영 팩을 구분하지 않으므로 넷의 확률이 같다고 봅니다.</li>
    <li>같은 풀의 영웅, 같은 등급의 장비도 확률이 같다고 봅니다.</li>
  </ul>
</template>
