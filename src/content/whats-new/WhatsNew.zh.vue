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

const editionDate = whatsNewEditionDate('zh')
</script>

<template>
  <article>
    <h1>最近更新 · {{ editionDate }}</h1>

    <section class="whats-new-entry">
      <h2>与 Honor Duel Lab 合作</h2>
      <p>
        Stargazer 现在与 Toto 和 Honor Duel Lab 合作。接下来的几个月里，荣誉对决的功能会陆续加入
        Stargazer，下面是第一批。
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PATH">荣誉对决商店计算器</LinkHeading>
      <WhatsNewPicture><HelpShopPicture /></WhatsNewPicture>
      <p>
        把眼前的荣誉对决商店和想要的英雄或装备填进去，它会给出本回合达成概率最高的一步、花费徽章最少的一步，并在本回合该停手时提示你。
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>荣誉对决棋盘</h2>
      <WhatsNewPicture><HelpDuelPicture /></WhatsNewPicture>
      <p>
        竞技场新增<b>荣誉对决</b>标签页，配有专用的棋盘。摆上英雄和体验单位，设置他们的品质和装备，再给双方各配一件灵器。灵器旁会显示该方的同阵营增益。
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PROBABILITY_PATH">荣誉对决商店概率</LinkHeading>
      <p>
        讲解商店背后的概率：一张卡片或一位英雄出现的概率有多大，平均要刷新多少次、花多少徽章，以及什么时候值得买卡包或锁定。
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>新的攻略页面</h2>
      <p>
        <RouterLink :to="guidePath('factions')">同阵营增益</RouterLink
        >列出同阵营英雄带来的攻击力与生命值加成，以及阵营克制带来的伤害增减。<RouterLink
          :to="guidePath('damage')"
          >伤害类型</RouterLink
        >说明物理、魔法、真实伤害与生命流失的区别，以及各自受哪些效果影响。<RouterLink
          :to="guidePath('glossary')"
          >术语表</RouterLink
        >解释技能描述中的属性、状态等用语。
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>新网址</h2>
      <p>
        Stargazer 已搬到 <b>{{ SITE_HOST }}</b
        >。旧网址的链接仍然可以打开，会自动来到这里。
      </p>
    </section>

    <section class="whats-new-also">
      <h2>其他新内容</h2>
      <ul>
        <li><b>赛季</b>标签页列出本赛季的魔法配饰和神话魔饰符文，以及能使用它们的英雄。</li>
        <li>
          打开<b>地图信息</b>后，巅峰联赛和公会征锋的地图上会标出增益格<span class="help-mouse"
            >，鼠标停在上面可以查看增益效果</span
          >。
        </li>
        <li>
          <a :href="pvpReportHref(8, 'zh')">第8赛季 PvP 报告</a>现在收录了第二届巅峰联赛的数据。
        </li>
      </ul>
    </section>
  </article>
</template>
