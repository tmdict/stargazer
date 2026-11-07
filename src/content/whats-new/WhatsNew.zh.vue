<script setup lang="ts">
import HelpGeneratorPicture from '@/components/help/HelpGeneratorPicture.vue'
import HelpWwwPicture from '@/components/help/HelpWwwPicture.vue'
import IconSparkle from '@/components/ui/IconSparkle.vue'
import UpgradeIcon from '@/components/ui/UpgradeIcon.vue'
import WhatsNewPicture from '@/components/whats-new/WhatsNewPicture.vue'
import WhatsNewPlacementPicture from '@/components/whats-new/WhatsNewPlacementPicture.vue'
import WhatsNewSkillsPicture from '@/components/whats-new/WhatsNewSkillsPicture.vue'
import WhatsNewThemePicture from '@/components/whats-new/WhatsNewThemePicture.vue'
import { SL_GENERATOR_PATH, WWW_PATH } from '@/lib/guide'
import { helpPath } from '@/lib/help'
import { pvpReportHref } from '@/lib/pvp/summary'
</script>

<template>
  <article>
    <h1>11月新功能</h1>
    <p class="whats-new-intro">过去几周最主要的新内容，较小的改动列在最后。</p>

    <section class="whats-new-entry">
      <h2>PvP阵容生成器</h2>
      <WhatsNewPicture><HelpGeneratorPicture /></WhatsNewPicture>
      <p>
        用你自己的英雄，为 1v1、3v3 或 5v5
        比赛（包括巅峰联赛和公会征锋）的每张地图各配一支队伍，队伍都选自玩家记录的对局。竞技场和「阵容」页面上的<span
          class="help-inline-btn"
          ><IconSparkle :size="13" /></span
        >会用你的英雄池一键填好友方的棋盘。
      </p>
      <p class="whats-new-links">
        <RouterLink :to="SL_GENERATOR_PATH">打开PvP阵容生成器</RouterLink>
        <RouterLink :to="helpPath('zh', 'generator')">使用说明</RouterLink>
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>站位提示</h2>
      <WhatsNewPicture><WhatsNewPlacementPicture /></WhatsNewPicture>
      <p>
        在竞技场或「阵容」页面上，把鼠标停在你的英雄上，就能看到它为什么适合站在这里：它的技能给谁带来什么、它偏向站在哪一侧，以及更适合它的格子（用绿色框出）。它默认开启，位于<b>地图信息</b>里。
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>谁会赢？</h2>
      <WhatsNewPicture><HelpWwwPicture /></WhatsNewPicture>
      <p>
        组好两支巅峰联赛队伍，看看哪一方更可能获胜，以及原因。<b>整场</b>会排一场巅峰联赛的全部五局。
      </p>
      <p class="whats-new-links">
        <RouterLink :to="WWW_PATH">打开谁会赢？</RouterLink>
        <RouterLink :to="helpPath('zh', 'www')">使用说明</RouterLink>
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>第8赛季 PvP 报告</h2>
      <p>这份报告收录巅峰联赛的阵容、克制关系与地图数据，现在也包括第二届巅峰联赛的对局。</p>
      <p class="whats-new-links">
        <a :href="pvpReportHref(8, 'zh')">打开报告</a>
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>按英雄显示技能</h2>
      <WhatsNewPicture><WhatsNewSkillsPicture /></WhatsNewPicture>
      <p>
        在<b>技能</b>菜单里，可以单独关闭某个英雄或神器的箭头和技能范围，也可以关闭友方或敌方全部的显示。你的选择会保留到页面重新加载为止。
      </p>
      <p class="whats-new-links">
        <RouterLink :to="helpPath('zh', 'grid')">使用说明</RouterLink>
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>深色模式</h2>
      <WhatsNewPicture><WhatsNewThemePicture /></WhatsNewPicture>
      <p>
        Stargazer
        会跟随设备的浅色或深色设置。点顶部的太阳或月亮按钮可以自己选择，网站会记住你的选择。
      </p>
    </section>

    <section class="whats-new-also">
      <h2>其他新内容</h2>
      <ul>
        <li><b>英雄池</b>标签页的<b>截图</b>可以用<b>英雄厅堂</b>中的英雄截图建立英雄池。</li>
        <li>谁会赢？的<b>截图</b>可以从巅峰联赛淘汰赛对阵界面填入整场对局。</li>
        <li>
          冠阶和精炼等级改用皇冠 <UpgradeIcon kind="paragon" /> 和星星
          <UpgradeIcon kind="refinement" /> 表示，不再用 P 和 R。
        </li>
        <li>保存的阵容除了按英雄，也可以按神器搜索。</li>
        <li>
          鼠标停在英雄列表里的英雄上会显示它的服装，打开<b>地图信息</b>里的<b>英雄皮肤</b>，地图上的英雄也会换上服装。
        </li>
        <li><b>机制</b>新增<b>急速</b>和<b>击飞</b>，可以找出为友方提供急速或把敌人击飞的英雄。</li>
        <li>神器和幻灵的文字可以用所有技能语言阅读，在技能窗口的语言菜单里切换。</li>
        <li>打开<b>技能</b>后，每只幻灵的灵能会标亮它落在的英雄。</li>
        <li>在英雄池菜单里，可以直接在某个英雄池那一行重命名或删除它。</li>
        <li>所有截图导入都能识别宽度 400 像素起的截图。</li>
        <li>幻灵有了职业，显示在悬停卡片和技能窗口里，并计入辛美尔的“冒险伙伴”。</li>
      </ul>
    </section>
  </article>
</template>
