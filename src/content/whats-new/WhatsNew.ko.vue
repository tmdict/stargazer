<script setup lang="ts">
import HelpGenerateButton from '@/components/help/HelpGenerateButton.vue'
import HelpGeneratorPicture from '@/components/help/HelpGeneratorPicture.vue'
import HelpWwwPicture from '@/components/help/HelpWwwPicture.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import UpgradeIcon from '@/components/ui/UpgradeIcon.vue'
import WhatsNewPicture from '@/components/whats-new/WhatsNewPicture.vue'
import WhatsNewPlacementPicture from '@/components/whats-new/WhatsNewPlacementPicture.vue'
import WhatsNewSkillsPicture from '@/components/whats-new/WhatsNewSkillsPicture.vue'
import WhatsNewThemePicture from '@/components/whats-new/WhatsNewThemePicture.vue'
import { whatsNewEditionDate } from '@/composables/useWhatsNew'
import { SL_GENERATOR_PATH, WWW_PATH } from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'

const editionDate = whatsNewEditionDate('ko')
</script>

<template>
  <article>
    <h1>새 기능 · {{ editionDate }}</h1>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="SL_GENERATOR_PATH">PvP 조합 생성기</LinkHeading>
      <WhatsNewPicture><HelpGeneratorPicture /></WhatsNewPicture>
      <p>
        내 영웅으로 1v1, 3v3, 5v5 매치(최강자 리그와 길드 격돌 포함)의 각 맵에 팀을 하나씩 짜
        줍니다. 팀은 플레이어들이 기록한 전투에서 골라냅니다. 아레나와 진형 페이지의
        <HelpGenerateButton />
        버튼은 로스터로 아군 보드를 한 번에 채웁니다.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>배치 팁</h2>
      <WhatsNewPicture><WhatsNewPlacementPicture /></WhatsNewPicture>
      <p>
        아레나나 진형 페이지에서 <span class="help-mouse">내 영웅 위에 마우스를 올리면</span
        ><span class="help-touch">내 영웅을 누르면</span> 그 자리가 왜 좋은지 알려 줍니다. 스킬이
        누구에게 무엇을 주는지, 앞과 뒤 중 어느 쪽에 서려 하는지, 더 잘 맞는 타일이 있다면 초록색
        테두리로 보여 줍니다. <b>맵 정보</b>를 켜면 볼 수 있으며, 메뉴에는 <b>배치 팁</b>이 처음부터
        체크되어 있습니다.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>영웅별 스킬 표시</h2>
      <WhatsNewPicture><WhatsNewSkillsPicture /></WhatsNewPicture>
      <p>
        <b>스킬</b> 메뉴에서 영웅이나 메아리별로, 또는 아군이나 적군 전체의 화살표와 스킬 범위를 끌
        수 있습니다. 선택은 페이지를 새로 고칠 때까지 유지됩니다.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="WWW_PATH">누가 이길까?</LinkHeading>
      <WhatsNewPicture><HelpWwwPicture /></WhatsNewPicture>
      <p>
        최강자 리그 팀 두 개를 구성하면 어느 쪽이 이길지, 그 이유와 함께 알려 줍니다.
        <b>매치</b>는 최강자 리그 매치의 다섯 경기를 모두 다룹니다.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :href="pvpReportHref(8, 'ko')">시즌 8 PvP 리포트</LinkHeading>
      <p>
        최강자 리그의 진형, 상성, 맵 데이터를 모은 리포트에 이제 두 번째 최강자 리그의 전투도
        들어갑니다.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>다크 모드</h2>
      <WhatsNewPicture><WhatsNewThemePicture /></WhatsNewPicture>
      <p>
        Stargazer는 기기의 라이트 또는 다크 설정을 따릅니다. 위쪽의 해 또는 달 버튼을 누르면 직접
        고를 수 있고, 사이트가 그 선택을 기억합니다.
      </p>
    </section>

    <section class="whats-new-also">
      <h2>그 밖의 새 기능</h2>
      <ul>
        <li>
          <b>영웅 로스터</b> 탭의 <b>스크린샷</b>은 <b>영웅의 전당</b>에서 찍은 영웅 스크린샷으로
          로스터를 만듭니다.
        </li>
        <li>
          파라곤과 제련 레벨을 P와 R 대신 왕관 <UpgradeIcon kind="paragon" />과 별
          <UpgradeIcon kind="refinement" />로 표시합니다.
        </li>
        <li>저장한 진형을 영웅뿐 아니라 메아리로도 검색할 수 있습니다.</li>
        <li>
          영웅 목록에서 영웅 위에 마우스를 올리면 의상이 보이고, <b>맵 정보</b>의 <b>영웅 스킨</b>을
          켜면 맵의 영웅도 의상으로 표시됩니다.
        </li>
        <li>
          <b>메커니즘</b>에 <b>급속</b>과 <b>에어본</b>이 추가되어, 아군에게 급속을 주거나 적을
          띄우는 영웅을 찾을 수 있습니다.
        </li>
        <li>
          메아리와 팬텀 설명을 모든 스킬 언어로 읽을 수 있습니다. 스킬 창의 언어 메뉴에서 고르세요.
        </li>
      </ul>
    </section>
  </article>
</template>
