describe('Admin SPA', () => {
  it('loads layout and routes', () => {
    cy.visit('/')
    cy.contains('DancerVibe')
    cy.visit('/templates')
    cy.contains('爬虫模版管理')
    cy.visit('/mapping-rules')
    cy.contains('映射规则管理')
  })
})
