# Rock Paper Scissors Contract

|           Solc version: 0.8.14           |  Optimizer enabled: true  |  Runs: 1000  | Block limit: 30000000 gas | |
|------------------------------------------|---------------------------|--------------|---------------|-------------|
|  Methods                                 |  Min        |  Max        |  Avg         |  # calls      |  usd (avg)  |
|  abortGame                               |          -  |          -  |       45161  |            2  |          -  |
|  acceptGame                              |          -  |          -  |       92763  |          183  |          -  |
|  claimPot                                |     114803  |     141863  |      130169  |           21  |          -  |
|  registerReferral                        |          -  |          -  |       44755  |          166  |          -  |
|  startNewGame                            |     105906  |     163404  |      162526  |          223  |          -  |
|  submitHashedMove                        |      59852  |      67465  |       63512  |          296  |          -  |
|  submitMove                              |      59805  |     184175  |       81732  |          260  |          -  |
|  surrenderGame                           |     137160  |     137436  |      137298  |           12  |          -  |
|  Deployments                             |             |             |              |  % of limit   |             |
|  RockPaperScissors                       |    1996890  |    2036750  |     2035772  |        6.8 %  |          -  |

  69 passing (20s)

Generated with:
```shell
REPORT_GAS=true npx hardhat test
```

Configured to be able to run on BSC main, test and local networks

Project specific commands:
```shell
npx hardhat deploy
npx hardhat new-game
npx hardhat read-game
```

To imitiate mining while running locally you need to provide:
```shell
MINE=true
```

Everything else works just like in [Advanced sample hardhat project](https://github.com/NomicFoundation/hardhat)
