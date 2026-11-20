# Bulário

O Bulário é um banco de dados offline e pesquisável de **bulas da FDA** (a agência de alimentos e medicamentos dos Estados Unidos), as informações oficiais que acompanham os medicamentos isentos de prescrição e os de venda sob prescrição. Depois de instalado, você pode procurar um medicamento pelo nome, partir de uma situação para chegar aos medicamentos indicados para ela e comparar duas bulas lado a lado, tudo sem conexão com a internet.

É um complemento opcional. Um monolith-nomad recém-instalado não o tem até você escolher instalá-lo, porque o conjunto de dados é grande.

> **Isto é informação de saúde, não orientação médica.** O Bulário mostra o texto da bula do fabricante registrado na FDA e associa situações a opções isentas de prescrição. Ele não substitui um médico, farmacêutico ou enfermeiro. Siga sempre as instruções do produto que você tem em mãos e, numa emergência real, procure ajuda profissional sempre que puder.

As bulas são as dos Estados Unidos e estão em inglês. Nomes comerciais, apresentações e indicações podem ser diferentes dos medicamentos vendidos no Brasil.

Na primeira vez que você abrir o Bulário num navegador, esse aviso aparece numa janela que você precisa confirmar antes de a página carregar. A confirmação fica guardada por navegador, então outro navegador ou dispositivo mostra o aviso de novo.

---

## Como instalar

Há duas formas de obter os dados, e as duas dão no mesmo lugar.

**Pelo Explorador de Conteúdo**, como parte de uma coleção:

1. Na tela inicial, abra o **Explorador de Conteúdo**.
2. Escolha a categoria **Medicina**.
3. Selecione o nível **Padrão**. O conteúdo dele aparece no cartão, e você verá o **FDA Drug Reference** (Bulário da FDA) entre os itens.
4. Confirme o download.

**Pela própria página do Bulário.** Abra o **Bulário** na tela inicial. Se não houver dados instalados, aparece um painel avisando que ainda não há dados de medicamentos da FDA, com um botão para baixá-los, que inicia o mesmo processo.

Nos dois casos, o processo roda em duas etapas, em segundo plano:

- **Download**: o monolith-nomad baixa o conjunto de dados de bulas do openFDA, cerca de **1,7 GB** compactado, em várias partes. Se a conexão cair, o download continua de onde parou.
- **Indexação**: o monolith-nomad carrega essas bulas num banco de busca offline rápido. Esta é a etapa mais longa, e os dados chegam a ocupar cerca de **8 a 10 GB** em disco.

Você não precisa ficar olhando. Pode sair da página que o processo continua, e a busca é ativada sozinha quando a indexação termina. Enquanto as etapas rodam, a página mostra o progresso das duas.

---

## Como navegar

Tudo fica atrás de um único bloco, **Bulário**, na tela inicial. Com os dados instalados, a página tem três abas.

### Busca por medicamento

Digite o nome de um medicamento, comercial ou genérico, e o monolith-nomad mostra as bulas da FDA correspondentes: para que serve o medicamento, a posologia, as advertências e os ingredientes, direto da bula oficial do fabricante.

Os resultados ficam **agrupados por princípio ativo**, em vez de listados como centenas de produtos quase idênticos. Uma busca por um analgésico comum devolve um grupo por princípio ativo, em vez de cada marca de farmácia separadamente, para você ver entre o que está escolhendo de fato.

### Por situação

Comece pelo problema em vez do produto. Escolha uma ou mais situações, como queimadura, febre ou diarreia, e o monolith-nomad lista os medicamentos cujas bulas da FDA as cobrem.

Ao selecionar mais de uma situação, a busca procura primeiro os medicamentos que cobrem **todas** elas e, depois, mostra os resultados de cada situação separadamente. Isso ajuda quando você está lidando com mais de um sintoma ao mesmo tempo e quer um único produto, se existir.

### Dados da FDA

Mostra de onde vieram os dados e o estado atual: se estão baixados e indexados, e quantas bulas foram carregadas. É também aqui que você refaz o download ou reinicia a indexação se algo precisar de atenção.

---

## Comparar dois medicamentos

Na página de detalhes de um medicamento, use a opção de **comparar as advertências da bula** para colocar duas bulas lado a lado e ler o que cada uma diz.

Isso põe as seções de advertências dos dois fabricantes uma ao lado da outra. A comparação **não** calcula interações medicamentosas e não diz se uma combinação é segura. Decidir se dois medicamentos podem ser tomados juntos é exatamente o tipo de pergunta a fazer a um farmacêutico ou médico.

---

## Manter os dados atualizados

As bulas da FDA mudam com o tempo. Se você ligou as **atualizações automáticas de conteúdo** (Configurações → Atualizações), o monolith-nomad verifica periodicamente se o openFDA publicou um conjunto de dados mais novo e atualiza o Bulário sozinho, como faz com o resto do seu conteúdo offline.

Com as atualizações automáticas desligadas, os dados ficam exatamente como estavam na instalação, o que é suficiente para uso offline. Você sempre pode refazer o download na aba **Dados da FDA** para trazer a versão mais recente.

---

## Sobre o armazenamento

O Bulário é o maior item da coleção Medicina → Padrão. Reserve cerca de **8 a 10 GB** de disco para ele depois da indexação, além do download de 1,7 GB.

Se o espaço estiver curto, o Explorador de Conteúdo mostra o tamanho total de um nível antes de você confirmar, para você saber o que está assumindo.
