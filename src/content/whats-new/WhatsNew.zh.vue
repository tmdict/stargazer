<script setup lang="ts">
import HelpDuelPicture from '@/components/help/HelpDuelPicture.vue'
import HelpShopPicture from '@/components/help/HelpShopPicture.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import WhatsNewBuffTilesPicture from '@/components/whats-new/WhatsNewBuffTilesPicture.vue'
import WhatsNewCharmsPicture from '@/components/whats-new/WhatsNewCharmsPicture.vue'
import WhatsNewDamagePicture from '@/components/whats-new/WhatsNewDamagePicture.vue'
import WhatsNewFactionsPicture from '@/components/whats-new/WhatsNewFactionsPicture.vue'
import WhatsNewGlossaryPicture from '@/components/whats-new/WhatsNewGlossaryPicture.vue'
import WhatsNewPicture from '@/components/whats-new/WhatsNewPicture.vue'
import { whatsNewEditionDate } from '@/composables/useWhatsNew'
import {
  guidePath,
  HD_SHOP_PATH,
  HD_SHOP_PROBABILITY_PATH,
  TOTO_DISCORD_URL,
  TOTO_SITE_URL,
} from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'
import { SITE_HOST } from '@/lib/site'

const editionDate = whatsNewEditionDate('zh')
</script>

<template>
  <article>
    <h1>最近更新 · {{ editionDate }}</h1>

    <section class="whats-new-entry">
      <h2>Stargazer × Honor Duel Lab 联动</h2>
      <p>
        Stargazer 与 Toto 的
        <a :href="TOTO_SITE_URL" target="_blank" rel="noopener noreferrer">Honor Duel Lab</a>
        展开合作，把它的荣誉对决工具和攻略带到 Stargazer。接下来的几个月里，更多荣誉对决功能和通用的
        PvP 机制攻略会陆续上线，敬请期待。想聊荣誉对决、了解后续动态，欢迎加入
        <a :href="TOTO_DISCORD_URL" target="_blank" rel="noopener noreferrer">Toto 的 Discord</a>。
      </p>
      <p>先来看看第一批内容：</p>
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
      <h2>新攻略</h2>
      <div class="whats-new-guides">
        <div class="link-area">
          <LinkHeading sub :to="guidePath('factions')">同阵营增益</LinkHeading>
          <WhatsNewPicture><WhatsNewFactionsPicture /></WhatsNewPicture>
          <p>同阵营英雄带来的攻击力与生命值加成，以及阵营克制带来的伤害增减。</p>
        </div>
        <div class="link-area">
          <LinkHeading sub :to="guidePath('damage')">伤害类型</LinkHeading>
          <WhatsNewPicture><WhatsNewDamagePicture /></WhatsNewPicture>
          <p>
            物理、魔法、真实伤害与生命流失的区别：怎样从技能描述中认出每一种，以及各自受哪些效果影响。
          </p>
        </div>
        <div class="link-area">
          <LinkHeading sub :to="guidePath('glossary')">术语表</LinkHeading>
          <WhatsNewPicture><WhatsNewGlossaryPicture /></WhatsNewPicture>
          <p>逐条解释技能描述中的属性、状态等用语。可以搜索，也可以按分类跳转。</p>
        </div>
      </div>
    </section>

    <section class="whats-new-entry">
      <h2>魔法配饰</h2>
      <WhatsNewPicture><WhatsNewCharmsPicture /></WhatsNewPicture>
      <p><b>赛季</b>标签页列出本赛季的魔法配饰和神话魔饰符文，以及能使用它们的英雄。</p>
    </section>

    <section class="whats-new-entry">
      <h2>增益格</h2>
      <WhatsNewPicture><WhatsNewBuffTilesPicture /></WhatsNewPicture>
      <p>
        打开<b>地图信息</b>后，巅峰联赛和公会征锋的地图上会标出增益格<span class="help-mouse"
          >，鼠标停在上面可以查看增益效果</span
        >。
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :href="pvpReportHref(8, 'zh')">第8赛季 PvP 报告</LinkHeading>
      <p>报告现在收录了第二届巅峰联赛的数据。</p>
    </section>

    <section class="whats-new-entry">
      <h2>新网址</h2>
      <p>
        Stargazer 已搬到 <b>{{ SITE_HOST }}</b
        >。旧网址的链接仍然可以打开，会自动来到这里。
      </p>
    </section>
  </article>
</template>
