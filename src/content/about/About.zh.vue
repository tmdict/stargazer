<script setup lang="ts">
import { guidePath, SL_GENERATOR_PATH } from '@/lib/guide'
import { helpPath } from '@/lib/help'
</script>

<template>
  <article>
    <h1>《剑与远征：启程》阵容搭配工具与PvP助手</h1>
    <p>
      Stargazer
      是一款《剑与远征：启程》的阵容搭配工具与PvP助手。你可以在竞技场地图上尝试不同阵容，看看站位对英雄技能有什么影响，也可以把阵型分享给好友或公会成员，一起讨论战术。你还可以：
    </p>
    <ul>
      <li>
        用<RouterLink :to="SL_GENERATOR_PATH">PvP阵容生成器</RouterLink
        >从你的英雄池中为每张地图配一套阵容。
      </li>
      <li>
        浏览<RouterLink :to="guidePath('index')">PvP 报告</RouterLink
        >，查看巅峰联赛各赛季的阵容、克制关系与地图数据。
      </li>
      <li>
        在<RouterLink to="/teams">阵容</RouterLink>页面管理英雄池，并保存 1、3 或 5 张地图的阵容。
      </li>
      <li>在<RouterLink to="/skills">技能资料库</RouterLink>中按技能机制查找英雄。</li>
    </ul>
    <p>
      想了解各项功能怎么用，请看<RouterLink :to="helpPath('zh')">Stargazer 使用说明</RouterLink>。
    </p>

    <h2>链接与致谢</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>：阵型构建工具、英雄优先级工具与数据库。
      </li>
      <li><a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>：AFKJ 数据库与攻略。</li>
      <li>
        感谢 Yaphalla、Toto's Honor Duel Archive 等 AFKJ 社区提供英雄资料，并测试多个技能的效果。
      </li>
      <li>
        图片及其他素材来自 Yaphalla、<a
          href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >与<a href="https://afk-journey.fandom.com/wiki/AFK_Journey_Wiki">AFK Journey Wiki</a>。
      </li>
    </ul>
  </article>
</template>
