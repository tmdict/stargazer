<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '关于',
  url: 'about',
  locale: 'zh',
})
</script>

<template>
  <article>
    <h1>剑与远征启程 · 竞技场模拟器</h1>
    <p>
      Stargazer是一个剑与远征：启程（AFK
      Journey）竞技场模拟器和规划工具。它让玩家可以在竞技场地图上尝试不同的英雄位置和队伍组合，并模拟各种游戏的机制，比如寻路算法和英雄技能，跟游戏的战斗竞技场一模一样！
    </p>
    <p>
      此工具的目的是让玩家能更方便测试不同竞技场阵型和技能的机制，可视化他们的攻击范围，并与朋友或公会成员分享阵型和战术。如需要有完整功能的综合阵型工具，我们推荐使用<a
        href="https://www.yaphalla.com/editor"
        >Yaphalla</a
      >。
    </p>

    <h2>如何使用</h2>
    <ul>
      <li><strong>构建团队：</strong>将角色和回响拖到地图上或点击它们以添加，删除和切换团队</li>
      <li>
        <strong>详细信息：</strong>切换显示/隐藏不同的模拟信息：
        <ul>
          <li><strong>平面地图：</strong>以自上而下的平面视角显示地图</li>
          <li><strong>网格信息：</strong>显示地图格子信息</li>
          <li><strong>技能：</strong>显示当前地图上角色的技能模拟效果</li>
          <li><strong>目标：</strong>显示攻击范围和移动路径</li>
          <li><strong>调试：</strong>显示调试信息</li>
        </ul>
      </li>
      <li><strong>编辑地图：</strong>使用地图编辑器以设计自定义竞技场</li>
      <li>
        <strong>分享团队：</strong
        >点击"链接"获取可分享的URL链接，"复制"将图像复制到剪贴板，或"下载"保存图像
      </li>
    </ul>

    <h2>提示</h2>
    <ul>
      <li>具有特殊能力的英雄会影响竞技场地图或显示特殊效果</li>
      <li>点击任何地图格子可通过弹出菜单快速放置英雄</li>
      <li>响应式设计 - 在手机和电脑上无缝运行！</li>
    </ul>

    <h2>链接和资源</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>：阵型构建器、优先级列表构建器和数据库。
      </li>
      <li><a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>： AFKJ数据库和指南。</li>
      <li>特别感谢Milan提供关于英雄技能以及各种相关机制信息。</li>
      <li>
        图片素材来源于<a href="https://www.yaphalla.com/">Yaphalla</a>与<a
          href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >。
      </li>
    </ul>
  </article>
</template>
