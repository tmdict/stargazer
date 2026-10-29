<script setup lang="ts">
import SlIcon from '@/components/guide/sl/SlIcon.vue'
import HelpBasicsPicture from '@/components/help/HelpBasicsPicture.vue'
import HelpGeneratorPicture from '@/components/help/HelpGeneratorPicture.vue'
import HelpImportPicture from '@/components/help/HelpImportPicture.vue'
import HelpMapsPicture from '@/components/help/HelpMapsPicture.vue'
import HelpModeSwitch from '@/components/help/HelpModeSwitch.vue'
import HelpRostersPicture from '@/components/help/HelpRostersPicture.vue'
import HelpTeamsPicture from '@/components/help/HelpTeamsPicture.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import HelpWwwPicture from '@/components/help/HelpWwwPicture.vue'
import IconBell from '@/components/ui/IconBell.vue'
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
import { SL_GENERATOR_PATH, WWW_PATH } from '@/lib/guide'

const SKILL = {
  hero: 'frieren',
  heroName: 'Frieren',
  title: 'Ultimate: Zoltraak',
  meta: 'Cooldown: 0 · Initial Cooldown: 0 · Range: Global',
  text: 'Frieren moves to the rearmost position that maximizes the number of enemies her Ultimate can hit, dealing 220% ATK damage per second.',
}
</script>

<template>
  <div class="help-top">
    <div>
      <h1 class="help-title">How to use Stargazer</h1>
      <p class="help-intro">
        Start with the basics. Everything else is further down if you need it.
      </p>
    </div>
    <HelpModeSwitch mouse="Mouse" touch="Touch" />
  </div>

  <section id="grid" class="help-sec">
    <h2>Using the grid</h2>
    <ol class="help-grid help-basics">
      <li>
        <HelpBasicsPicture kind="add" />
        <h3>Add a hero</h3>
        <p class="help-mouse">
          Click an empty tile and a hero list pops up there. Click a hero, or type a name and press
          <kbd>Enter</kbd> once only one hero is left. The cursor stays in the search box, so you
          can keep typing and pressing <kbd>Enter</kbd> to add more.
        </p>
        <p class="help-touch">Tap an empty tile, then tap a hero in the list below.</p>
      </li>
      <li>
        <HelpBasicsPicture kind="move" />
        <h3>Move or swap</h3>
        <p class="help-mouse">Drag a hero to another tile. Drop it on another hero to swap them.</p>
        <p class="help-touch">
          Tap a hero, then tap where you want it. Tap another hero instead to swap them.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="remove" />
        <h3>Remove a hero</h3>
        <p class="help-mouse">
          Click it on the grid, or click it again in the hero list. Heroes already on the grid are
          grey in the list.
        </p>
        <p class="help-touch">
          Tap it twice on the grid, or tap it again in the hero list. Heroes already on the grid are
          grey in the list.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="target" />
        <h3>Skill targeting</h3>
        <p>
          Turn on <b>Skills</b>. Arrows show which enemy each hero goes after, and skill ranges show
          up on the map.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="skills" :skill="SKILL" />
        <h3>View skills</h3>
        <p class="help-mouse">
          Right-click any hero on the grid or in the hero list. Hovering over one shows its faction,
          class and range.
        </p>
        <p class="help-touch">
          Press and hold any hero on the grid or in the hero list until the circle fills up.
        </p>
      </li>
      <li>
        <HelpBasicsPicture kind="mechanics" />
        <h3>Filter by mechanic</h3>
        <p>
          Pick an effect in <b>Mechanics</b>, above the hero list, like <b>Summon</b> or
          <b>Energy Denial</b>. Some narrow further, like <b>Temp Buff</b> to <b>Opening</b>.
          <span class="help-mouse"><b>+</b> lays every mechanic out as buttons.</span>
        </p>
      </li>
    </ol>
  </section>

  <section id="teams" class="help-sec">
    <h2>Teams and saved teams</h2>
    <div class="help-grid">
      <HelpTeamsPicture />
      <div class="help-side">
        <p class="help-lead">Plan several fights at once, and keep the teams you like.</p>
        <ol class="help-steps">
          <li>
            <span>
              Choose <b>1v1</b>, <b>3v3</b> or <b>5v5</b>. <b>SL</b> and <b>GD</b> load the Supreme
              League and Guild Duel maps.
            </span>
          </li>
          <li>
            <span>
              Set up each grid like in the Arena.
              <span class="help-mouse">
                To swap two grids, drag
                <span class="help-inline-btn round"><IconSwap :size="10" /></span> onto the other
                one.
              </span>
              <span class="help-touch">
                To swap two grids, tap
                <span class="help-inline-btn round"><IconSwap :size="10" /></span>, then tap the
                other one. If it says <b>Tap again to swap</b>, tap it once more.
              </span>
            </span>
          </li>
          <li>
            <span>
              <b>Save</b> adds the team to the <b>Saved</b> tab, or updates the one you loaded.
              <b>Save as New</b> makes a copy.
            </span>
          </li>
          <li>
            <span>
              <b>Load</b> puts one side of a saved team back on the grids, on either side.
            </span>
          </li>
          <li>
            <span> In <b>Saved</b>, type a hero's name to find the teams that use that hero. </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          In <b>Saved</b>, <span class="help-mouse">click</span
          ><span class="help-touch">tap</span> a team's name to rename it.
        </li>
        <li>
          Pick heroes from the list under the search box to see only the teams that field them
          together. A team's name works too.
        </li>
        <li>
          <span class="help-inline-btn"><IconImagePlus :size="13" /></span> imports a match from
          screenshots, as <a href="#import">Import from screenshots</a> shows.
        </li>
        <li>Saved teams stay in your browser. <b>Export</b> makes a backup file.</li>
      </ul>
    </div>
  </section>

  <section id="rosters" class="help-sec">
    <h2>Rosters</h2>
    <div class="help-grid">
      <HelpRostersPicture />
      <div class="help-side">
        <p class="help-lead">
          A roster is a list of the heroes you own, with their levels. Pick one and the hero list
          only shows those heroes.
        </p>
        <ol class="help-steps">
          <li>
            <span
              >Go to the <b>Rosters</b> tab and choose <b>New</b>. Use the pencil to rename
              it.</span
            >
          </li>
          <li>
            <span class="help-mouse">
              Click the heroes you own, or drag across several. Click <b>P</b> or <b>R</b> under a
              hero to set its level.
            </span>
            <span class="help-touch">
              Tap the heroes you own. Tap <b>P</b> or <b>R</b> under a hero to set its level.
            </span>
          </li>
          <li>
            <span>
              Choose your roster at the top of the hero list. Heroes go on the grid at your levels.
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          The buttons above the heroes change everyone you can see. To change only some, choose
          <b>Select</b>, pick those heroes, then pick a level.
        </li>
        <li>Pick <b>All heroes</b> to see every hero again.</li>
        <li>
          Rosters are saved in your browser. <b>Export</b> and <b>Import</b> move them to another
          device.
        </li>
      </ul>
    </div>
  </section>

  <section id="import" class="help-sec">
    <h2>Import from screenshots</h2>
    <div class="help-grid">
      <HelpImportPicture />
      <div class="help-side">
        <p class="help-lead">
          Turn game screenshots into a saved team or a roster, instead of placing every hero by
          hand.
        </p>
        <h3 class="help-col-h">A match</h3>
        <ol class="help-steps">
          <li>
            <span>
              On the Teams page, press
              <span class="help-inline-btn"><IconImagePlus :size="13" /></span> next to <b>Load</b>.
            </span>
          </li>
          <li>
            <span>
              Add one <b>Battle Stats</b> screen per map. That gives both teams' heroes, their
              levels, their artifacts and who won.
            </span>
          </li>
          <li>
            <span>
              To put each hero on its exact tile, add the formation screenshots too. Formation
              screenshots also work alone, and each one becomes a team.
            </span>
          </li>
          <li>
            <span>
              For a Supreme League match whose formations weren't saved, add one paused replay
              screenshot per map instead, then set the tile each unit started on. This works on a
              computer only.
            </span>
          </li>
          <li>
            <span>
              Check anything the importer is unsure of, which it shows first, then press
              <b>Save as New</b>. The match becomes a new saved team.
            </span>
          </li>
        </ol>
      </div>
      <div class="help-below">
        <h3 class="help-col-h">A roster</h3>
        <ol class="help-steps">
          <li>
            <span>In the <b>Rosters</b> tab, press <b>Screenshots</b>.</span>
          </li>
          <li>
            <span>
              Add screenshots of your heroes from the <b>Resonating Hall</b>. Take as many as you
              like, as long as every hero shows whole in at least one.
            </span>
          </li>
          <li>
            <span>
              Check any hero it's unsure of, then press <b>Save as New Roster</b>. The roster is
              picked for you.
            </span>
          </li>
        </ol>
        <ul class="help-notes reading-secondary">
          <li>
            <a href="#www">Who Would Win?</a> also takes screenshots, of the Supreme League knockout
            matchup screen.
          </li>
          <li>You can paste a screenshot anywhere in the import window.</li>
          <li>Cropped screenshots and whole phone screens both work.</li>
          <li>Screenshots stay on your device.</li>
          <li>
            When you correct a hero, the importer remembers that hero on this device. A reset link
            under the review clears what it has learned.
          </li>
          <li>Match screens have only been tested with the game in English.</li>
        </ul>
      </div>
    </div>
  </section>

  <section id="maps" class="help-sec">
    <h2>Map editor</h2>
    <div class="help-grid">
      <HelpMapsPicture />
      <div class="help-side">
        <p class="help-lead">Change an arena's tiles, or draw a map of your own.</p>
        <ol class="help-steps">
          <li>
            <span>In the Arena, go to the <b>Maps</b> tab and turn on <b>Edit Tiles</b>.</span>
          </li>
          <li>
            <span>
              Pick a tile type: <b>Empty</b>, <b>Ally Tile</b>, <b>Enemy Tile</b>, <b>Blocked</b> or
              <b>Breakable</b>.
            </span>
          </li>
          <li>
            <span class="help-mouse">
              Click a tile to paint it, or hold the button down and drag across several.
            </span>
            <span class="help-touch">Tap each tile you want to paint.</span>
          </li>
          <li>
            <span>Turn <b>Edit Tiles</b> off to put heroes on the grid again.</span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>Painting a tile that has a hero on it removes the hero.</li>
        <li>
          <b>Fill</b> paints every tile with the chosen type. <b>Clear</b> puts the arena back the
          way it was. Both remove all heroes.
        </li>
        <li>A shared link keeps your edited map.</li>
      </ul>
    </div>
  </section>

  <section id="generator" class="help-sec">
    <h2>5v5 team generator</h2>
    <div class="help-grid">
      <HelpGeneratorPicture />
      <div class="help-side">
        <p class="help-lead">
          Get a Supreme League team for each of the five maps, made from your own heroes and picked
          from games players recorded.
        </p>
        <ol class="help-steps">
          <li>
            <span>
              In the <b>Guide</b>, open the
              <RouterLink :to="SL_GENERATOR_PATH">5v5 team generator</RouterLink>.
            </span>
          </li>
          <li>
            <span>
              Pick your roster next to <b>Roster</b>, or make one with <b>Screenshots</b>.
              <b>All heroes</b> uses every hero, fully upgraded.
            </span>
          </li>
          <li>
            <span class="help-mouse">
              Click heroes to add or remove them, or drag across several. Click <b>P</b> or
              <b>R</b> under a hero to set its level. Your saved roster stays as it is.
            </span>
            <span class="help-touch">
              Tap heroes to add or remove them, and tap <b>P</b> or <b>R</b> under a hero to set its
              level. Your saved roster stays as it is.
            </span>
          </li>
          <li>
            <span>
              Choose <b>SL</b> for the Supreme League maps, or <b>Default</b> to use map 1 for all
              five. Then press <b>Generate</b>.
            </span>
          </li>
          <li>
            <span>
              The set shows above your heroes: one team on each map, each with its own artifact, and
              no hero used twice. <b>Save as team</b> saves it and opens it on the Teams page.
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          Under each map, <SlIcon name="players" class="help-inline-icon" /> is how many players
          used that team's comp on the map, and <SlIcon name="record" class="help-inline-icon" />
          the comp's wins and losses there.
        </li>
        <li>
          <SlIcon name="lock" class="help-inline-icon" /> marks the core heroes, which stay.
          <SlIcon name="swap" class="help-inline-icon" /> lists swaps taken from recorded teams of
          the same comp, using your heroes the set leaves free: the hero or pair on the left for any
          on the right, best first.
        </li>
        <li>
          <b>Chance to win the match</b> is against a typical opponent, not a forecast of your next
          match, so use it to compare sets. <b>How it works</b> explains where it comes from.
        </li>
        <li>
          <b>About the data</b>, next to the page title, says which season the teams come from and
          how many games they cover.
        </li>
      </ul>
    </div>
  </section>

  <section id="www" class="help-sec">
    <h2>Who Would Win?</h2>
    <div class="help-grid">
      <HelpWwwPicture />
      <div class="help-side">
        <p class="help-lead">Set up two Supreme League teams and see which should win, and why.</p>
        <ol class="help-steps">
          <li>
            <span>
              In the <b>Guide</b>, open <RouterLink :to="WWW_PATH">Who Would Win?</RouterLink>.
              Choose <b>One game</b>, or <b>Match</b> for the five games of a Supreme League match.
            </span>
          </li>
          <li>
            <span class="help-mouse">
              Click an empty slot, then pick heroes from the list that opens. They fill the team's
              slots in turn. Click a hero to take it off.
            </span>
            <span class="help-touch">
              Tap a slot, then tap a hero in the list. Tap a hero in a slot to take it off.
            </span>
          </li>
          <li>
            <span>
              <span class="help-mouse">Click</span><span class="help-touch">Tap</span> the round
              slot at the outer end of a team to pick its artifact. The phantimal follows from the
              heroes.
            </span>
          </li>
          <li>
            <span>
              Set levels with <b>P</b> and <b>R</b> under each hero, or for a whole team with its
              <b>Upgrades</b> menu. Heroes start at your roster's levels on Team A, and fully
              upgraded on Team B.
            </span>
          </li>
          <li>
            <span>
              Press <b>Predict winner</b>. <b>Why</b> splits the chance into heroes, counters,
              artifacts and upgrades. <span class="help-mouse">Click</span
              ><span class="help-touch">Tap</span> a row to see what's behind it.
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          In <b>Match</b>, a team fields each hero and artifact once across the five games, as in
          the game, so the lists leave out what it already uses. The result gives Team A's chance to
          win three games of five, the chance of each final score, and a line for each game. Pick
          one to see its reasons.
        </li>
        <li>
          <b>Screenshots</b> fills all five games from the Supreme League knockout matchup screen.
          One screenshot will do, or several taken while scrolling, as long as each team's cards
          show whole in at least one.
        </li>
        <li>
          A team can have fewer than five heroes. Each empty slot counts as weaker than the season's
          weakest hero, with no upgrades.
        </li>
        <li>
          A mark next to the verdict warns where the records are thin, such as a hero with few
          recorded games this season. Such a hero counts as close to average.
        </li>
        <li><b>Swap sides</b> swaps the two teams, and <b>Clear</b> empties the games shown.</li>
      </ul>
    </div>
  </section>

  <section id="reference" class="help-sec">
    <h2>Quick reference</h2>
    <div class="help-grid">
      <div>
        <h3 class="help-col-h">Grid display</h3>
        <div class="help-rows">
          <HelpToggle label="Flat" />
          <p>View the map from straight above</p>
          <HelpToggle label="Invert" />
          <p>Flip the map around</p>
          <HelpToggle label="Team" />
          <p>Hide the enemy side, handy for screenshots</p>
          <HelpToggle label="Grid Info" split />
          <p>Show hero cards and levels on the grid</p>
          <HelpToggle label="Syn" />
          <p>Add a friend's hero as your assist</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">Hero levels</h3>
        <div class="help-rows">
          <UpgradePill :paragon="2" :refinement="1" />
          <p>
            <span class="help-mouse">Click <b>P</b> or <b>R</b> to raise it.</span>
            <span class="help-touch">Tap <b>P</b> or <b>R</b> to raise it.</span>
            After 4 it goes back to 0.
          </p>
          <span inert
            ><UpgradeDock><UpgradeLayerChips :lit="ATTR_PARAGON" /></UpgradeDock
          ></span>
          <p>With Grid Info hero cards on, this bar raises or maxes a whole side</p>
        </div>
        <h3 class="help-col-h">Keyboard</h3>
        <div class="help-rows">
          <span><kbd>Ctrl</kbd> <kbd>K</kbd></span>
          <p>
            Search heroes and skills from any page. On a Mac, it's
            <span class="help-keys"><kbd>⌘</kbd> <kbd>K</kbd>.</span>
          </p>
          <span><kbd>/</kbd></span>
          <p>Also opens the search</p>
          <span><kbd>Alt</kbd> <kbd>L</kbd></span>
          <p>Switch to the next language</p>
          <span><kbd>Esc</kbd></span>
          <p>Close a popup</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">Side panel tabs</h3>
        <div class="help-rows">
          <span class="help-tab">Characters</span>
          <p>All heroes, with filters for faction, class and mechanics</p>
          <span class="help-tab">Seasonal</span>
          <p>This season's phantimals and artifacts</p>
          <span class="help-tab">Maps</span>
          <p>Pick another arena, or draw your own</p>
          <span class="help-tab">Rosters</span>
          <p>Your heroes and their levels</p>
          <span class="help-tab">Saved</span>
          <p>Your saved teams, on the Teams page</p>
        </div>
      </div>
    </div>
  </section>

  <section id="tips" class="help-sec">
    <h2>Tips and tricks</h2>
    <ul class="help-grid help-tips">
      <li>
        <IconSearch :size="18" />
        <span>Hover over a hero to see its faction, class, range and energy.</span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>Hold <b>Shift</b> while right-clicking to get your browser's normal menu.</span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>Phantimals and artifacts show their skills the same way heroes do.</span>
      </li>
      <li>
        <IconBell :size="18" />
        <span>
          Some heroes pick a mode before battle, like Dunlingr and Natsu. A button on the hero shows
          its mode, and with <b>Skills</b> on its arrows take the mode's color.
          <span class="help-mouse">Click it to switch modes.</span>
          <span class="help-touch"
            >To switch, tap the hero, then the round button next to <b>Skills</b>.</span
          >
        </span>
      </li>
      <li>
        <IconLink :size="18" />
        <span>
          <b>Link</b> copies a link to everything on your grid, so friends see exactly what you see.
          <b>Copy</b> and <b>Download</b> save the grid as a picture.
        </span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>The pop-up hero list has its own roster menu at the top.</span>
      </li>
      <li>
        <IconFilter :size="18" />
        <span>
          The <b>Guide</b> has a Mechanics page with every hero for each mechanic. Pick two or more
          to see who has them all.
        </span>
      </li>
      <li>
        <IconGlobe :size="18" />
        <span>Skill pages can be read in 16 languages. Use the menu at the top of the page.</span>
      </li>
      <li>
        <IconImage :size="18" />
        <span
          >The Teams page has an <b>Image Stitcher</b> for joining screenshots into one
          picture.</span
        >
      </li>
      <li>
        <IconDownload :size="18" />
        <span>On the Teams page, each grid has its own copy and download buttons.</span>
      </li>
      <li>
        <IconSave :size="18" />
        <span>
          <b>Clear</b> empties the grids but keeps the team you loaded, so <b>Save</b> still updates
          it.
        </span>
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>
          Add <kbd>?t=debug</kbd> to the Arena's address for a hidden <b>Debug</b> tab, which draws
          the path each hero takes to its target.
        </span>
      </li>
    </ul>
  </section>

  <p class="help-foot reading-meta">
    Something not working? Send feedback with the envelope icon at the top.
  </p>
</template>
