<script setup lang="ts">
import { RouterLink } from 'vue-router'

import HelpDuelPicture from '@/components/help/HelpDuelPicture.vue'
import HelpShopPicture from '@/components/help/HelpShopPicture.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import WhatsNewPicture from '@/components/whats-new/WhatsNewPicture.vue'
import { whatsNewEditionDate } from '@/composables/useWhatsNew'
import { guidePath, HD_SHOP_PATH, HD_SHOP_PROBABILITY_PATH } from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'
import { SITE_HOST } from '@/lib/site'

const editionDate = whatsNewEditionDate('ko')
</script>

<template>
  <article>
    <h1>새 기능 · {{ editionDate }}</h1>

    <section class="whats-new-entry">
      <h2>Honor Duel Lab과 함께합니다</h2>
      <p>
        Stargazer가 Toto, 그리고 Honor Duel Lab과 함께하게 되었습니다. 앞으로 몇 달에 걸쳐 명예의
        결투 기능을 Stargazer에 차례로 추가할 예정이며, 아래가 그 첫 번째입니다.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PATH">명예의 결투 상점 계산기</LinkHeading>
      <WhatsNewPicture><HelpShopPicture /></WhatsNewPicture>
      <p>
        지금 보이는 명예의 결투 상점과 찾는 영웅이나 장비를 입력하세요. 이번 라운드에 완성할 확률이
        가장 높은 수와 휘장이 가장 적게 드는 수를 보여 주고, 이번 라운드는 멈추는 편이 나으면 그렇게
        알려 줍니다.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>명예의 결투 맵</h2>
      <WhatsNewPicture><HelpDuelPicture /></WhatsNewPicture>
      <p>
        아레나에 전용 맵이 있는 <b>명예의 결투</b> 탭이 생겼습니다. 영웅과 체험 유닛을 배치하고
        등급과 장비를 정한 뒤, 양 진영에 아티팩트를 하나씩 장착하세요. 아티팩트 옆에는 그 진영의
        동일 진영 버프가 표시됩니다.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PROBABILITY_PATH">명예의 결투 상점 확률</LinkHeading>
      <p>
        상점의 확률을 설명하는 가이드입니다. 카드나 영웅이 나올 확률, 평균적으로 필요한 새로고침
        횟수와 휘장, 팩이나 잠금이 유리한 때를 다룹니다.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>새 가이드 페이지</h2>
      <p>
        <RouterLink :to="guidePath('factions')">동일 진영 버프</RouterLink>에서는 같은 진영 영웅으로
        얻는 공격력·HP 증가와 진영 상성에 따른 대미지 증감을 볼 수 있습니다.
        <RouterLink :to="guidePath('damage')">대미지 유형</RouterLink>은 물리·마법·고정 대미지와 HP
        유실의 차이, 유형별로 영향을 주는 효과를 정리했습니다.
        <RouterLink :to="guidePath('glossary')">용어집</RouterLink>은 스킬 설명에 나오는 속성, 상태
        등 용어의 뜻을 설명합니다.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>새 주소</h2>
      <p>
        Stargazer가 <b>{{ SITE_HOST }}</b
        >으로 이사했습니다. 예전 주소의 링크도 이곳으로 연결됩니다.
      </p>
    </section>

    <section class="whats-new-also">
      <h2>그 밖의 새 기능</h2>
      <ul>
        <li>
          <b>시즌</b> 탭에서 이번 시즌의 주문석과 신화 주문석 룬, 그리고 각각을 쓸 수 있는 영웅을 볼
          수 있습니다.
        </li>
        <li>
          <b>맵 정보</b>를 켜면 최강자 리그와 길드 격돌 맵에 버프 타일이 표시됩니다<span
            class="help-mouse"
            >. 버프 타일에 마우스를 올리면 버프 효과를 볼 수 있습니다</span
          >.
        </li>
        <li>
          <a :href="pvpReportHref(8, 'ko')">시즌 8 PvP 리포트</a>에 이제 두 번째 최강자 리그의
          데이터가 들어갑니다.
        </li>
      </ul>
    </section>
  </article>
</template>
