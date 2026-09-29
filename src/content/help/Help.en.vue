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
        <HelpBasicsPicture kind="share" />
        <h3>Share your grid</h3>
        <p>
          <b>Link</b> copies a link to your grid. <b>Copy</b> and <b>Download</b> save it as a
          picture.
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
                other one.
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
              <span class="help-inline-btn"><IconImagePlus :size="13" /></span> imports a match from
              screenshots.
            </span>
          </li>
        </ol>
      </div>
      <ul class="help-notes reading-secondary">
        <li>
          In <b>Saved</b>, <span class="help-mouse">click</span
          ><span class="help-touch">tap</span> a team's name to rename it.
        </li>
        <li>Search saved teams by name or by hero.</li>
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
              Click the heroes you own. Click <b>P</b> or <b>R</b> under a hero to set its level.
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
          The buttons above the heroes change everyone you can see. Filter first to change just a
          few.
        </li>
        <li>Pick <b>All heroes</b> to see every hero again.</li>
        <li>
          Rosters are saved in your browser. <b>Export</b> and <b>Import</b> move them to another
          device.
        </li>
      </ul>
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
          <p>Switch between English and Chinese</p>
          <span><kbd>Esc</kbd></span>
          <p>Close a popup</p>
        </div>
      </div>
      <div>
        <h3 class="help-col-h">Side panel tabs</h3>
        <div class="help-rows">
          <span class="help-tab">Characters</span>
          <p>All heroes, with filters for faction, class and skill type</p>
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
        <IconLink :size="18" />
        <span
          >A shared link includes everything on the grid, so friends see exactly what you see.</span
        >
      </li>
      <li>
        <IconChevronRight :size="18" />
        <span>The pop-up hero list has its own roster menu at the top.</span>
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
    </ul>
  </section>

  <p class="help-foot reading-meta">
    Something not working? Send feedback with the envelope icon at the top.
  </p>
</template>
