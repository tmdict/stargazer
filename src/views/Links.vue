<template>
  <main>
    <div class="section">
      <div class="content">
        <h1>Useful Links and Resources</h1>
        <table class="links">
          <thead>
            <tr>
              <th>Resources</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a href="https://www.yaphalla.com/" target="_blank">
                  <span class="link-title">Yaphalla</span>: Team formation builder, priority list
                  builder, and database.
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="https://www.prydwen.gg/afk-journey/" target="_blank">
                  <span class="link-title">Prydwen: AFKJ</span>: AFKJ database and guides.
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

  .links th,
  .links td {
    padding: 8px 10px;
  }
}
</style>
