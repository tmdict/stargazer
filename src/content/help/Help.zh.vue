<script setup lang="ts">
import HelpBasicsPicture from '@/components/help/HelpBasicsPicture.vue'
import HelpMapsPicture from '@/components/help/HelpMapsPicture.vue'
import HelpModeSwitch from '@/components/help/HelpModeSwitch.vue'
import HelpRostersPicture from '@/components/help/HelpRostersPicture.vue'
import HelpTeamsPicture from '@/components/help/HelpTeamsPicture.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconGlobe from '@/components/ui/IconGlobe.vue'
import IconImage from '@/components/ui/IconImage.vue'
import IconImagePlus from '@/components/ui/IconImagePlus.vue'
import IconLink from '@/components/ui/IconLink.vue'
import IconSave from '@/components/ui/IconSave.vue'
import IconSearch from '@/components/ui/IconSearch.vue'
import IconSwap from '@/components/ui/IconSwap.vue'
import UpgradeDock from '@/components/ui/UpgradeDock.vue'
import UpgradeLayerChips from '@/components/ui/UpgradeLayerChips.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { ATTR_PARAGON } from '@/lib/characters/attributes'

const SKILL = {
  hero: 'frieren',
  heroName: '芙莉莲',
  title: '终极技能：一般攻击魔法',
  meta: '冷却时间：0 · 初始冷却时间：0 · 技能范围：全场',
  text: '芙莉莲移动至尽可能最靠后的能覆盖最多敌人的位置，对3格矩形范围的敌人发射持续3秒的魔法攻击。',
}
</script>

<template>
  <div class="help-top">
    <div>
      <h1 class="help-title">Stargazer 使用说明</h1>
      <p class="help-intro">先看基本操作，其他内容在下面，需要时再查。</p>
    </div>
    <HelpModeSwitch mouse="鼠标" touch="触屏" />
  </div>

  <section id="grid" class="help-sec">
    <h2>棋盘操作</h2>
    <ol class="help-grid help-basics">
      <li>
        <HelpBasicsPicture kind="add" />
        <h3>添加英雄</h3>
        <p class="help-mouse">
          点击空格子，旁边会弹出英雄列表。点英雄就能放上去，也可以输入名字，只剩一个英雄时按
          <kbd>Enter</kbd>。光标会一直停在搜索框里，可以接着输入、按
          <kbd>Enter</kbd>，连续放好几个。
        </p>
        <p class="help-touch">先点空格子，再点下方列表里的英雄。</p>
      </li>
      <li>
        <HelpBasicsPicture kind="move" />
        <h3>移动或交换</h3>
        <p class="help-mouse">把英雄拖到其他格子。拖到另一个英雄身上，两人会互换位置。</p>
        <p class="help-touch">先点英雄，再点想去的格子。点另一个英雄则互换位置。</p>
      </li>
      <li>
        <HelpBasicsPicture kind="remove" />
        <h3>移除英雄</h3>
        <p class="help-mouse">
          在棋盘上点一下英雄，或在英雄列表里再点一次。已经上场的英雄在列表中显示为灰色。
        </p>
        <p class="help-touch">
          在棋盘上连点两下英雄，或在英雄列表里再点一次。已经上场的英雄在列表中显示为灰色。
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="target" />
        <h3>技能目标</h3>
        <p>打开<b>技能</b>，箭头会显示每个英雄的攻击目标，技能范围也会标在地图上。</p>
      </li>
      <li>
        <HelpBasicsPicture kind="skills" :skill="SKILL" />
        <h3>查看技能</h3>
        <p class="help-mouse">
          在棋盘上或英雄列表里右键点击任意英雄。鼠标停在英雄上，可以看到阵营、职业和射程。
        </p>
        <p class="help-touch">在棋盘上或英雄列表里长按任意英雄，等圆圈转满即可。</p>
      </li>
      <li>
        <HelpBasicsPicture kind="share" />
        <h3>分享棋盘</h3>
        <p><b>链接</b>会复制当前棋盘的链接，<b>复制</b>和<b>下载</b>可以把棋盘存成图片。</p>
      </li>
    </ol>
  </section>

  <section id="teams" class="help-sec">
    <h2>阵容与保存的阵容</h2>
    <div class="help-grid">
      <HelpTeamsPicture />
      <div class="help-side">
        <p class="help-lead">同时规划多场对战，并保存喜欢的阵容。</p>
        <ol class="help-steps">
          <li>
            <span>
              选择 <b>1v1</b>、<b>3v3</b> 或
              <b>5v5</b>。<b>巅峰联赛</b>和<b>公会征锋</b>会载入对应的比赛地图。
            </span>
          </li>
          <li>
            <span class="help-mouse"
              >像在竞技场里一样布置每个棋盘。想交换两个棋盘，把<span class="help-inline-btn round"
                ><IconSwap :size="10" /></span
              >拖到另一个棋盘上。</span
            >
            <span class="help-touch"
              >像在竞技场里一样布置每个棋盘。想交换两个棋盘，先点<span class="help-inline-btn round"
                ><IconSwap :size="10" /></span
              >，再点另一个棋盘。如果显示<b>再次点击交换</b>，再点一次即可。</span
            >
          </li>
          <li>
            <span>
              <b>保存</b
              >会把阵容加入<b>阵容</b>标签页，如果是载入的阵容则直接更新。<b>另存为</b>会另外存一份。
            </span>
          </li>
          <li>
            <span>
              <b>载入</b>可以把已保存阵容的一方放回棋盘，敌我两边都行。
              <span class="help-inline-btn"><IconImagePlus :size="13" /></span>
              可以从对战截图导入整场对局。
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>在<b>阵容</b>标签页里，点阵容名称即可重命名。</li>
        <li>可以按名称或英雄搜索保存的阵容。</li>
        <li>保存的阵容存在你的浏览器里，用<b>导出</b>可以备份成文件。</li>
      </ul>
    </div>
  </section>

  <section id="rosters" class="help-sec">
    <h2>英雄池</h2>
    <div class="help-grid">
      <HelpRostersPicture />
      <div class="help-side">
        <p class="help-lead">
          英雄池就是你拥有的英雄和他们的强化等级。选中后，英雄列表只显示这些英雄。
        </p>
        <ol class="help-steps">
          <li><span>打开<b>英雄池</b>标签页，点<b>新建</b>。点铅笔图标可以改名。</span></li>
          <li>
            <span>点选你拥有的英雄，再点英雄下方的 <b>P</b> 或 <b>R</b> 调整等级。</span>
          </li>
          <li><span>在英雄列表顶部选择你的英雄池，英雄上场时会带上你设置的等级。</span></li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>英雄上方的按钮会作用于当前显示的所有英雄，只想改一部分就先筛选。</li>
        <li>选<b>全部英雄</b>可以重新看到所有英雄。</li>
        <li>英雄池存在你的浏览器里，用<b>导出</b>和<b>导入</b>可以转到其他设备。</li>
      </ul>
    </div>
  </section>

  <section id="maps" class="help-sec">
    <h2>地图编辑</h2>
    <div class="help-grid">
      <HelpMapsPicture />
      <div class="help-side">
        <p class="help-lead">修改竞技场的格子，或者画一张自己的地图。</p>
        <ol class="help-steps">
          <li><span>在竞技场打开<b>地图</b>标签页，勾选<b>编辑图块</b>。</span></li>
          <li>
            <span>
              选择格子类型：<b>空格</b>、<b>友方格子</b>、<b>敌人格子</b>、<b>障碍</b>或<b>可摧毁</b>。
            </span>
          </li>
          <li>
            <span class="help-mouse">点击格子即可涂上，也可以按住鼠标拖过多个格子。</span>
            <span class="help-touch">逐个点击想涂的格子。</span>
          </li>
          <li><span>取消勾选<b>编辑图块</b>，就能继续往棋盘上放英雄。</span></li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>涂到有英雄的格子上，英雄会被移除。</li>
        <li>
          <b>填充</b>把所有格子涂成选中的类型，<b>清除</b>把竞技场恢复原样。两者都会移除所有英雄。
        </li>
        <li>分享链接会保留你编辑过的地图。</li>
      </ul>
    </div>
  </section>

  <section id="reference" class="help-sec">
    <h2>速查</h2>
    <div class="help-grid">
      <div>
        <h3 class="help-col-h">棋盘显示</h3>
        <div class="help-rows">
          <HelpToggle label="平面" />
          <p>从正上方看地图</p>
          <HelpToggle label="反转" />
          <p>把地图翻转过来</p>
          <HelpToggle label="己方" />
          <p>隐藏敌方，方便截图</p>
          <HelpToggle label="地图信息" split />
          <p>在棋盘上显示英雄卡片和等级</p>
          <HelpToggle label="协同" />
          <p>加入好友的英雄作为助战</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">英雄等级</h3>
        <div class="help-rows">
          <UpgradePill :paragon="2" :refinement="1" />
          <p>点 <b>P</b> 或 <b>R</b> 升一级，超过 4 级会回到 0。</p>
          <span inert
            ><UpgradeDock><UpgradeLayerChips :lit="ATTR_PARAGON" /></UpgradeDock
          ></span>
          <p>打开地图信息的英雄卡片后，这一栏可以一次提升或拉满一整边。</p>
        </div>
        <h3 class="help-col-h">快捷键</h3>
        <div class="help-rows">
          <span><kbd>Ctrl</kbd> <kbd>K</kbd></span>
          <p>
            在任何页面搜索英雄和技能，Mac 上是
            <span class="help-keys"><kbd>⌘</kbd> <kbd>K</kbd></span>
          </p>
          <span><kbd>/</kbd></span>
          <p>也能打开搜索</p>
          <span><kbd>Alt</kbd> <kbd>L</kbd></span>
          <p>切换中英文</p>
          <span><kbd>Esc</kbd></span>
          <p>关闭弹窗</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">侧边栏标签页</h3>
        <div class="help-rows">
          <span class="help-tab">英雄</span>
          <p>所有英雄，可按阵营、职业和技能类型筛选</p>
          <span class="help-tab">赛季</span>
          <p>本赛季的幻灵和神器</p>
          <span class="help-tab">地图</span>
          <p>换一张竞技场地图，或自己画一张</p>
          <span class="help-tab">英雄池</span>
          <p>你的英雄和等级</p>
          <span class="help-tab">阵容</span>
          <p>保存的阵容，在阵容页面</p>
        </div>
      </div>
    </div>
  </section>

  <section id="tips" class="help-sec">
    <h2>小技巧</h2>
    <ul class="help-grid help-tips">
      <li>
        <IconSearch :size="18" /><span>鼠标停在英雄上，可以看到阵营、职业、射程和能量。</span>
      </li>
      <li>
        <IconChevronRight :size="18" /><span
          >按住 <b>Shift</b> 再右键，会打开浏览器自己的菜单。</span
        >
      </li>
      <li><IconChevronRight :size="18" /><span>幻灵和神器也能像英雄一样查看技能。</span></li>
      <li>
        <IconLink :size="18" /><span>分享的链接包含棋盘上的全部内容，朋友看到的和你一模一样。</span>
      </li>
      <li>
        <IconChevronRight :size="18" /><span>棋盘上弹出的英雄列表顶部，也可以切换英雄池。</span>
      </li>
      <li><IconGlobe :size="18" /><span>技能页面支持 16 种语言，在页面顶部的菜单里切换。</span></li>
      <li>
        <IconImage :size="18" /><span>阵容页面有<b>图片拼接</b>工具，可以把多张截图拼成一张。</span>
      </li>
      <li><IconDownload :size="18" /><span>阵容页面的每个棋盘都有自己的复制和下载按钮。</span></li>
      <li>
        <IconSave :size="18" /><span
          ><b>清除</b>会清空棋盘，但仍关联到你载入的阵容，<b>保存</b>依旧会更新它。</span
        >
      </li>
    </ul>
  </section>

  <p class="help-foot reading-meta">遇到问题？点页面顶部的信封图标反馈。</p>
</template>
