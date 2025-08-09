<template>
  <main>
    <div class="section">
      <div class="content">
        <h1>Useful Links and Resources</h1>
        <table class="links">
          <!-- Resources Section -->
          <thead>
            <tr>
              <th>Resources</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a href="https://www.yaphalla.com/">
                  <span class="link-title">Yaphalla</span>: Team formation builder, priority list
                  builder, and database.
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.prydwen.gg/afk-journey/">
                  <span class="link-title">Prydwen: AFKJ</span>: AFKJ database and guides.
                </a>
              </td>
            </tr>
          </tbody>

          <!-- Discord Section -->
          <thead>
            <tr>
              <th>Discord</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a href="https://discord.gg/afkjourney">
                  <span class="link-title">Official AFK Journey Discord</span>: Official community
                  server.
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://discord.gg/yaphalla">
                  <span class="link-title">Yaphalla Discord</span>: Community for team building and
                  strategies.
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://discord.com/invite/z22yE5eFHK">
                  <span class="link-title">Fight Club Discord</span>: PvP community.
                </a>
              </td>
            </tr>
          </tbody>

          <thead>
            <tr>
              <th>Communities</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a
                  href="https://search.bilibili.com/all?vt=22353469&keyword=%E5%89%91%E4%B8%8E%E8%BF%9C%E5%BE%81%E5%90%AF%E7%A8%8B&from_source=video_tag&order=pubdate"
                >
                  <span class="link-title">Bilibili</span>: Latest Bilibili VODs.
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.reddit.com/r/AFKJourney/">
                  <span class="link-title">r/AFKJourney</span>: Reddit community.
                </a>
              </td>
            </tr>
          </tbody>

          <thead>
            <tr>
              <th>Content Creators</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a href="https://www.youtube.com/@browniegames865">
                  <span class="link-title">Brownie</span>: PvP
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.youtube.com/@ElfeYT">
                  <span class="link-title">Elfe</span>: PvP
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.youtube.com/@PuzzleAFKJ">
                  <span class="link-title">Puzzle</span>: Guides
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.youtube.com/@Wraec">
                  <span class="link-title">Wraec</span>: Guides
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.youtube.com/@Zeeebo">
                  <span class="link-title">Zeeebo</span>: Guides
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://space.bilibili.com/401793216">
                  <span class="link-title">若隐寒星</span>: Guides
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://space.bilibili.com/11018422">
                  <span class="link-title">松鼠年糕鱼</span>: Guides
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>
</template>

<style scoped>
.links {
  width: 100%;
  margin-top: 2rem;
  border-collapse: collapse;
  background: var(--color-bg-primary);
  font-size: 0.95rem;
}

.links th {
  background: var(--color-bg-tertiary);
  padding: 6px 12px;
  text-align: left;
  font-weight: 600;
  border-top: 1px solid var(--color-border-primary);
  border-bottom: 1px solid var(--color-border-primary);
}

.links td {
  padding: 0;
  border-top: 1px solid var(--color-border-primary);
  border-bottom: 1px solid var(--color-border-primary);
}

.links tbody tr:hover {
  background: var(--color-bg-tertiary);
}

.links td a {
  display: block;
  padding: 6px 12px;
  color: var(--color-text-primary);
  text-decoration: none;
}

.links td a:hover {
  color: var(--color-text-primary);
}

.link-title {
  color: var(--color-primary);
  font-weight: bold;
}

.links td a:hover .link-title {
  text-decoration: underline;
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .links {
    font-size: 0.9rem;
  }
}
</style>
