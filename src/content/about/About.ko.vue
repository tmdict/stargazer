<script setup lang="ts">
import { guidePath, SL_GENERATOR_PATH } from '@/lib/guide'
import { helpPath } from '@/lib/help'
</script>

<template>
  <article>
    <h1>AFK: 새로운 여정 진형 빌더와 PvP 도우미</h1>
    <p>
      Stargazer는 AFK: 새로운 여정의 진형 빌더이자 PvP 도우미입니다. 아레나 맵에서 다양한 영웅
      조합을 시도하고, 배치가 영웅 스킬에 어떤 영향을 주는지 확인할 수 있습니다. 친구나 길드원과
      진형을 공유하며 전술을 의논할 수도 있습니다. 다음 기능도 이용할 수 있습니다.
    </p>
    <ul>
      <li>
        <RouterLink :to="SL_GENERATOR_PATH">PvP 조합 생성기</RouterLink>로 내 로스터에 있는 영웅
        중에서 맵별 추천 조합을 찾을 수 있습니다.
      </li>
      <li>
        <RouterLink :to="guidePath('index')">PvP 리포트</RouterLink>에서 최강자 리그 시즌별 진형,
        상성, 맵 데이터를 확인할 수 있습니다.
      </li>
      <li>
        <RouterLink to="/teams">진형</RouterLink> 페이지에서 로스터를 관리하고 맵 1개, 3개 또는
        5개에 쓸 진형을 저장할 수 있습니다.
      </li>
      <li>
        <RouterLink to="/skills">스킬 데이터베이스</RouterLink>에서 스킬 메커니즘으로 영웅을 찾을 수
        있습니다.
      </li>
    </ul>
    <p>
      각 기능의 사용법은
      <RouterLink :to="helpPath('ko')">Stargazer 사용법</RouterLink>에서 확인할 수 있습니다.
    </p>

    <h2>링크와 크레딧</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>: 진형 빌더, 우선순위 목록 빌더,
        데이터베이스.
      </li>
      <li>
        <a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>: AFKJ 데이터베이스와 가이드.
      </li>
      <li>
        영웅 정보와 여러 스킬 테스트에 도움을 준 Yaphalla, Toto's Honor Duel Archive 등 AFKJ
        커뮤니티에 감사드립니다.
      </li>
      <li>
        이미지 및 기타 자료 제공: Yaphalla,
        <a href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >, <a href="https://afk-journey.fandom.com/wiki/AFK_Journey_Wiki">AFK Journey Wiki</a>.
      </li>
    </ul>
  </article>
</template>
