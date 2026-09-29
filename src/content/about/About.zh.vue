<script setup lang="ts">
import { helpPath } from '@/lib/help'
</script>

<template>
  <article>
    <h1>剑与远征启程 · 竞技场模拟器</h1>
    <p>
      Stargazer 是一款剑与远征：启程（AFK
      Journey）竞技场模拟与规划工具，可在六边形网格上自由调整英雄站位与阵容搭配，并模拟寻路、技能等核心机制，完整还原游戏中的竞技场战斗。此外还提供多款实用工具。
    </p>
    <p>
      本工具旨在帮助玩家快速测试不同阵型下的技能机制，直观查看攻击范围，并与好友或公会成员分享阵型、交流战术。如需更完整的阵型构建功能，推荐使用<a
        href="https://www.yaphalla.com/editor"
        >Yaphalla 阵型工具</a
      >。
    </p>
    <p>
      想了解各项功能怎么用，请看<RouterLink :to="helpPath('zh')">Stargazer 使用说明</RouterLink>。
    </p>

    <h2>实用链接与资源</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>：阵型构建工具、英雄优先级工具与数据库。
      </li>
      <li><a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>：AFKJ 数据库与攻略。</li>
      <li>
        图片素材来自<a href="https://www.yaphalla.com/">Yaphalla</a>与<a
          href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >。
      </li>
    </ul>
  </article>
</template>
