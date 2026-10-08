<script setup lang="ts">
import { helpPath } from '@/lib/help'
</script>

<template>
  <article>
    <h1>AFK: 새로운 여정 아레나 시뮬레이터</h1>
    <p>
      Stargazer는 AFK: 새로운 여정의 아레나 시뮬레이터이자 진형 구상 도구이며, 몇 가지 보조 기능도
      함께 제공합니다. 실제 게임의 아레나처럼 육각형 맵 위에서 영웅 배치와 팀 구성을 자유롭게 시험해
      볼 수 있습니다.
    </p>
    <p>
      이 도구는 다양한 아레나 진형에서 스킬 메커니즘을 빠르게 확인하고, 공격 범위를 눈으로 살펴보며,
      친구나 길드원과 진형을 공유해 전술을 논의할 수 있도록 만들었습니다. 모든 기능을 갖춘 본격적인
      진형 편성에는 <a href="https://www.yaphalla.com/editor">Yaphalla의 빌더</a>를 추천합니다.
    </p>
    <p>
      각 기능의 사용법은
      <RouterLink :to="helpPath('ko')">Stargazer 사용법</RouterLink>에서 확인할 수 있습니다.
    </p>

    <h2>유용한 링크와 자료</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>: 진형 빌더, 우선순위 목록 빌더,
        데이터베이스.
      </li>
      <li>
        <a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>: AFKJ 데이터베이스와 가이드.
      </li>
      <li>
        이미지 자료 제공: <a href="https://www.yaphalla.com/">Yaphalla</a>,
        <a href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >.
      </li>
    </ul>
  </article>
</template>
