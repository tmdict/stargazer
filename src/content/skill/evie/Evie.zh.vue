<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('evie', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>伊芙</h1>

      <h2>非永久增益 (瞬发)</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，伊芙召唤羽毛笔自动跟随[[最靠后]]的友军，后续每隔[[3]]秒使羽毛笔切换跟随至累计输出最高的友军，使其每秒恢复[[120%]]生命值，并提高[[20%]]攻击力。当该友军累计造成自身初始攻击力[[250%]]伤害时，羽毛笔将向除当前跟随的友军以外最虚弱的两名友军分别发射一枚治疗球，治疗球可恢复[[45%]]生命值，该效果每[[0.5]]秒内至多触发一次。
      </p>

      <h3>觉醒之力</h3>
      <p>
        在潜伏期间收集到所有存活的敌方英雄的情报后，额外召唤一根羽毛笔跟随输出次高的友军，每名友军至多被一根羽毛笔跟随。
      </p>

      <h2>大招打断</h2>

      <h3>终极技能</h3>
      <p>
        主动释放时，选择累计输出最高的一名敌人进行持续[[6]]秒的审讯，审讯期间目标处于[[定身]]状态且每秒受到[[180%]]的伤害，若已收集目标的情报，审讯期间还会沉默该敌人。
      </p>
    </article>
  </StyledText>
</template>
