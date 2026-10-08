<script setup lang="ts">
import HelpBasicsPicture from '@/components/help/HelpBasicsPicture.vue'
import HelpMapsPicture from '@/components/help/HelpMapsPicture.vue'
import HelpModeSwitch from '@/components/help/HelpModeSwitch.vue'
import HelpRostersPicture from '@/components/help/HelpRostersPicture.vue'
import HelpTeamsPicture from '@/components/help/HelpTeamsPicture.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconFilter from '@/components/ui/IconFilter.vue'
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
  heroName: '프리렌',
  title: '궁극기: 일반 공격 마법',
  meta: '쿨타임: 0 · 초기 쿨타임: 0 · 스킬 범위: 전체',
  text: '프리렌이 가능한 가장 뒤의 최대한 많은 적군을 타격할 수 있는 위치로 이동해, 3칸 직사각형 범위 내 적군을 3초 동안 마법으로 공격한다.',
}
</script>

<template>
  <div class="help-top">
    <div>
      <h1 class="help-title">Stargazer 사용법</h1>
      <p class="help-intro">
        기본 사용법부터 시작하세요. 나머지 기능은 필요할 때 아래에서 찾아보면 됩니다.
      </p>
    </div>
    <HelpModeSwitch mouse="마우스" touch="터치" />
  </div>

  <section id="grid" class="help-sec">
    <h2>맵 사용하기</h2>
    <ol class="help-grid help-basics">
      <li>
        <HelpBasicsPicture kind="add" />
        <h3>영웅 추가</h3>
        <p class="help-mouse">
          빈 타일을 클릭하면 그 자리에 영웅 목록이 나타납니다. 영웅을 클릭하거나, 이름을 입력해
          영웅이 하나만 남으면 <kbd>Enter</kbd>를 누르세요. 커서가 검색창에 그대로 있으므로 계속
          입력하고 <kbd>Enter</kbd>를 눌러 영웅을 더 추가할 수 있습니다.
        </p>
        <p class="help-touch">빈 타일을 누른 뒤 아래 목록에서 영웅을 누르세요.</p>
      </li>
      <li>
        <HelpBasicsPicture kind="move" />
        <h3>이동 또는 교체</h3>
        <p class="help-mouse">
          영웅을 다른 타일로 드래그하세요. 다른 영웅 위에 놓으면 서로 자리가 바뀝니다.
        </p>
        <p class="help-touch">
          영웅을 누른 뒤 옮길 타일을 누르세요. 다른 영웅을 누르면 서로 자리가 바뀝니다.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="remove" />
        <h3>영웅 제거</h3>
        <p class="help-mouse">
          맵에서 영웅을 클릭하거나, 영웅 목록에서 다시 클릭하세요. 이미 맵에 있는 영웅은 목록에서
          회색으로 표시됩니다.
        </p>
        <p class="help-touch">
          맵에서 영웅을 두 번 누르거나, 영웅 목록에서 다시 누르세요. 이미 맵에 있는 영웅은 목록에서
          회색으로 표시됩니다.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="target" />
        <h3>스킬 타겟팅</h3>
        <p>
          <b>스킬</b>을 켜세요. 각 영웅이 어느 적을 노리는지 화살표로 표시되고, 스킬 범위가 맵에
          나타납니다.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="skills" :skill="SKILL" />
        <h3>스킬 보기</h3>
        <p class="help-mouse">
          맵이나 영웅 목록에서 영웅을 우클릭하세요. 마우스를 올리면 진영, 직업, 사정거리가
          표시됩니다.
        </p>
        <p class="help-touch">맵이나 영웅 목록에서 영웅을 원이 다 찰 때까지 길게 누르세요.</p>
      </li>
      <li>
        <HelpBasicsPicture kind="mechanics" />
        <h3>메커니즘으로 필터링</h3>
        <p>
          영웅 목록 위의 <b>메커니즘</b>에서 <b>소환</b>이나 <b>에너지 차단</b> 같은 효과를
          선택하세요. <b>비영구 버프</b>에서 <b>전투 시작</b>처럼 더 좁힐 수 있는 항목도 있습니다.
          <span class="help-mouse"><b>+</b>를 누르면 모든 메커니즘이 버튼으로 펼쳐집니다.</span>
        </p>
      </li>
    </ol>
  </section>

  <section id="teams" class="help-sec">
    <h2>진형과 저장한 진형</h2>
    <div class="help-grid">
      <HelpTeamsPicture />
      <div class="help-side">
        <p class="help-lead">여러 전투를 한 번에 구상하고, 마음에 드는 진형을 보관하세요.</p>
        <ol class="help-steps">
          <li>
            <span>
              <b>1v1</b>, <b>3v3</b>, <b>5v5</b> 중에서 선택하세요. <b>최강자 리그</b>와
              <b>길드 격돌</b>은 해당 콘텐츠의 맵을 불러옵니다.
            </span>
          </li>
          <li>
            <span>
              아레나에서처럼 각 맵을 구성하세요.
              <span class="help-mouse">
                두 맵을 서로 바꾸려면
                <span class="help-inline-btn round"><IconSwap :size="10" /></span> 버튼을 다른 맵
                위로 드래그하세요.
              </span>
              <span class="help-touch">
                두 맵을 서로 바꾸려면
                <span class="help-inline-btn round"><IconSwap :size="10" /></span> 버튼을 누른 뒤
                다른 맵을 누르세요. <b>한 번 더 누르면 교체됩니다</b>라고 표시되면 한 번 더
                누르세요.
              </span>
            </span>
          </li>
          <li>
            <span>
              <b>저장</b>은 진형을 <b>저장 목록</b> 탭에 추가하거나, 불러온 진형을 갱신합니다.
              <b>새로 저장</b>은 사본을 만듭니다.
            </span>
          </li>
          <li>
            <span>
              <b>불러오기</b>는 저장한 진형의 한쪽 진영을 맵의 원하는 진영에 다시 배치합니다.
              <span class="help-inline-btn"><IconImagePlus :size="13" /></span> 버튼은 스크린샷에서
              대전을 가져옵니다.
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          <b>저장 목록</b>에서 진형 이름을 <span class="help-mouse">클릭하면</span
          ><span class="help-touch">누르면</span> 이름을 바꿀 수 있습니다.
        </li>
        <li>저장한 진형은 이름이나 영웅으로 검색할 수 있습니다.</li>
        <li>
          저장한 진형은 브라우저에 보관됩니다. <b>내보내기</b>로 백업 파일을 만들 수 있습니다.
        </li>
      </ul>
    </div>
  </section>

  <section id="rosters" class="help-sec">
    <h2>영웅 로스터</h2>
    <div class="help-grid">
      <HelpRostersPicture />
      <div class="help-side">
        <p class="help-lead">
          로스터는 보유한 영웅과 그 레벨을 담은 목록입니다. 하나를 선택하면 영웅 목록에 해당 영웅만
          표시됩니다.
        </p>
        <ol class="help-steps">
          <li>
            <span
              ><b>영웅 로스터</b> 탭에서 <b>새로 만들기</b>를 선택하세요. 연필 아이콘으로 이름을
              바꿀 수 있습니다.</span
            >
          </li>
          <li>
            <span class="help-mouse">
              보유한 영웅을 클릭하세요. 영웅 아래의 <b>P</b> 또는 <b>R</b>을 클릭하면 레벨을 설정할
              수 있습니다.
            </span>
            <span class="help-touch">
              보유한 영웅을 누르세요. 영웅 아래의 <b>P</b> 또는 <b>R</b>을 누르면 레벨을 설정할 수
              있습니다.
            </span>
          </li>
          <li>
            <span>
              영웅 목록 맨 위에서 로스터를 선택하세요. 영웅이 설정한 레벨로 맵에 배치됩니다.
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          영웅 위의 버튼은 화면에 보이는 모든 영웅에 적용됩니다. 일부만 바꾸려면 먼저 필터로
          좁히세요.
        </li>
        <li><b>모든 영웅</b>을 선택하면 전체 영웅이 다시 표시됩니다.</li>
        <li>
          로스터는 브라우저에 저장됩니다. <b>내보내기</b>와 <b>가져오기</b>로 다른 기기에 옮길 수
          있습니다.
        </li>
      </ul>
    </div>
  </section>

  <section id="maps" class="help-sec">
    <h2>맵 에디터</h2>
    <div class="help-grid">
      <HelpMapsPicture />
      <div class="help-side">
        <p class="help-lead">아레나의 타일을 바꾸거나 나만의 맵을 직접 그려 보세요.</p>
        <ol class="help-steps">
          <li>
            <span>아레나에서 <b>맵</b> 탭으로 이동해 <b>타일 편집</b>을 켜세요.</span>
          </li>
          <li>
            <span>
              타일 종류를 선택하세요: <b>빈 타일</b>, <b>아군 타일</b>, <b>적군 타일</b>,
              <b>장애물</b>, <b>파괴 가능</b>.
            </span>
          </li>
          <li>
            <span class="help-mouse">
              타일을 클릭해 칠하거나, 버튼을 누른 채 여러 타일 위로 드래그하세요.
            </span>
            <span class="help-touch">칠할 타일을 하나씩 누르세요.</span>
          </li>
          <li>
            <span><b>타일 편집</b>을 끄면 다시 영웅을 배치할 수 있습니다.</span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>영웅이 있는 타일을 칠하면 그 영웅은 제거됩니다.</li>
        <li>
          <b>채우기</b>는 모든 타일을 선택한 종류로 칠합니다. <b>지우기</b>는 아레나를 원래 상태로
          되돌립니다. 둘 다 모든 영웅을 제거합니다.
        </li>
        <li>공유 링크에는 편집한 맵이 그대로 담깁니다.</li>
      </ul>
    </div>
  </section>

  <section id="reference" class="help-sec">
    <h2>빠른 참조</h2>
    <div class="help-grid">
      <div>
        <h3 class="help-col-h">맵 표시</h3>
        <div class="help-rows">
          <HelpToggle label="평면" />
          <p>맵을 바로 위에서 내려다봅니다</p>
          <HelpToggle label="반전" />
          <p>맵을 뒤집습니다</p>
          <HelpToggle label="아군" />
          <p>적군 진영을 숨깁니다. 스크린샷을 찍을 때 유용합니다</p>
          <HelpToggle label="맵 정보" split />
          <p>맵에 영웅 카드와 레벨을 표시합니다</p>
          <HelpToggle label="협력" />
          <p>친구의 영웅을 협력 영웅으로 추가합니다</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">영웅 레벨</h3>
        <div class="help-rows">
          <UpgradePill :paragon="2" :refinement="1" />
          <p>
            <span class="help-mouse"><b>P</b> 또는 <b>R</b>을 클릭하면 올라갑니다.</span>
            <span class="help-touch"><b>P</b> 또는 <b>R</b>을 누르면 올라갑니다.</span>
            4 다음에는 0으로 돌아갑니다.
          </p>
          <span inert
            ><UpgradeDock><UpgradeLayerChips :lit="ATTR_PARAGON" /></UpgradeDock
          ></span>
          <p>
            맵 정보의 영웅 카드가 켜져 있으면, 이 버튼들로 한쪽 진영의 영웅 레벨을 한꺼번에 올리거나
            최대로 설정할 수 있습니다
          </p>
        </div>
        <h3 class="help-col-h">키보드</h3>
        <div class="help-rows">
          <span><kbd>Ctrl</kbd> <kbd>K</kbd></span>
          <p>
            어느 페이지에서나 영웅과 스킬을 검색합니다. Mac에서는
            <span class="help-keys"><kbd>⌘</kbd> <kbd>K</kbd>입니다.</span>
          </p>
          <span><kbd>/</kbd></span>
          <p>검색을 여는 또 다른 방법입니다</p>
          <span><kbd>Alt</kbd> <kbd>L</kbd></span>
          <p>다음 언어로 전환합니다</p>
          <span><kbd>Esc</kbd></span>
          <p>팝업을 닫습니다</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">사이드 패널 탭</h3>
        <div class="help-rows">
          <span class="help-tab">영웅</span>
          <p>모든 영웅과 진영, 직업, 메커니즘 필터</p>
          <span class="help-tab">시즌</span>
          <p>이번 시즌의 팬텀과 메아리</p>
          <span class="help-tab">맵</span>
          <p>다른 아레나를 선택하거나 직접 그립니다</p>
          <span class="help-tab">영웅 로스터</span>
          <p>보유한 영웅과 레벨</p>
          <span class="help-tab">저장 목록</span>
          <p>진형 페이지에 있는 저장한 진형</p>
        </div>
      </div>
    </div>
  </section>

  <section id="tips" class="help-sec">
    <h2>팁과 요령</h2>
    <ul class="help-grid help-tips">
      <li>
        <IconSearch :size="18" />
        <span>영웅에 마우스를 올리면 진영, 직업, 사정거리, 에너지가 표시됩니다.</span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span><b>Shift</b>를 누른 채 우클릭하면 브라우저의 기본 메뉴가 열립니다.</span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>팬텀과 메아리도 영웅과 같은 방법으로 스킬을 볼 수 있습니다.</span>
      </li>
      <li>
        <IconLink :size="18" />
        <span>
          <b>링크</b>는 맵의 모든 내용을 담은 링크를 복사하므로, 친구도 똑같은 화면을 볼 수
          있습니다. <b>복사</b>와 <b>다운로드</b>는 맵을 이미지로 저장합니다.
        </span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>팝업 영웅 목록 맨 위에도 로스터 메뉴가 있습니다.</span>
      </li>
      <li>
        <IconFilter :size="18" />
        <span>
          <b>가이드</b>의 메커니즘 페이지에서 메커니즘별 영웅을 모두 볼 수 있습니다. 둘 이상을
          선택하면 모두 가진 영웅이 표시됩니다.
        </span>
      </li>
      <li>
        <IconGlobe :size="18" />
        <span>스킬 페이지는 16개 언어로 읽을 수 있습니다. 페이지 위쪽의 메뉴를 이용하세요.</span>
      </li>
      <li>
        <IconImage :size="18" />
        <span
          >진형 페이지에는 스크린샷 여러 장을 한 장으로 합치는 <b>이미지 이어 붙이기</b>가
          있습니다.</span
        >
      </li>
      <li>
        <IconDownload :size="18" />
        <span>진형 페이지에서는 맵마다 복사와 다운로드 버튼이 따로 있습니다.</span>
      </li>
      <li>
        <IconSave :size="18" />
        <span>
          <b>지우기</b>는 맵을 비우지만 불러온 진형은 유지하므로, <b>저장</b>하면 그 진형이
          갱신됩니다.
        </span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>
          아레나 주소에 <kbd>?t=debug</kbd>를 붙이면 숨겨진 <b>디버그</b> 탭이 나타나며, 각 영웅이
          대상까지 이동하는 경로를 그려 줍니다.
        </span>
      </li>
    </ul>
  </section>

  <p class="help-foot reading-meta">문제가 있나요? 위쪽의 봉투 아이콘으로 의견을 보내 주세요.</p>
</template>
