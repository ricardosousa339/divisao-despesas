# Divisor de Despesas

## Visão Geral
O Divisor de Despesas é uma aplicação web simples projetada para ajudar os usuários a gerenciar e dividir despesas entre várias pessoas. Os usuários podem adicionar, editar e excluir despesas, bem como visualizar um resumo das despesas totais e quanto cada pessoa deve ou tem a receber.

## Características
- Adicionar despesas com descrição, pagador e valor
- Selecionar participantes específicos para cada despesa
- Editar despesas existentes
- Excluir despesas
- Calcular despesas totais e custo por pessoa
- Exibir ajustes necessários para cada pessoa com base em suas despesas
- Sugerir pagamentos otimizados entre os participantes

## Estrutura do Projeto
```
expense-splitter
├── index.html          # Documento HTML principal
├── css
│   └── style.css      # Estilos para a aplicação
├── js
│   ├── app.js         # Funcionalidade principal em JavaScript
│   ├── expense.js     # Definição da classe de despesas
│   └── calculations.js # Funções de cálculo
├── img                # Diretório para imagens
└── README.md          # Documentação do projeto
```

## Primeiros Passos
Para começar a usar a aplicação Divisor de Despesas, siga estas etapas:

1. **Clone o repositório**:
   ```
   git clone <repository-url>
   ```

2. **Abra o projeto**:
   Navegue até o diretório do projeto:
   ```
   cd expense-splitter
   ```

3. **Abra `index.html`**:
   Abra o arquivo `index.html` no seu navegador para visualizar a aplicação.

## Uso
- Insira o nome da pessoa, a descrição da despesa e o valor gasto nos campos de entrada.
- Selecione os participantes da despesa.
- Clique no botão "Adicionar Despesa" para registrar a despesa.
- Para editar uma despesa, clique no botão "Editar" ao lado da despesa que deseja modificar.
- Para excluir uma despesa, clique no botão "Excluir" ao lado da despesa.
- Visualize o resumo das despesas e ajustes na parte inferior da aplicação.
- Utilize a sugestão de pagamentos otimizados para facilitar os acertos entre os participantes.

## Contribuindo
Contribuições são bem-vindas! Se você tiver sugestões de melhorias ou novos recursos, por favor, abra uma issue ou envie um pull request.

## Licença
Este projeto está licenciado sob a Licença MIT. Consulte o arquivo LICENSE para mais detalhes.