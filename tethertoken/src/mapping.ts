import {
    Transfer as TransferEvent,
    Approval as ApprovalEvent,
    Issue as IssueEvent,
    Redeem as RedeemEvent,
    AddedBlackList as AddedBlackListEvent,
    RemovedBlackList as RemovedBlackListEvent,
    Params as ParamsEvent,
    TetherToken
  } from "../generated/TetherToken/TetherToken";
  import {
    Token,
    Account,
    Transfer,
    DailyMetric,
    UserDailyMetric,
    WeeklyMetric,
    BlacklistAction,
    Approval,
    ParamChange
  } from "../generated/schema";
  import { BigInt, Address, ethereum, BigDecimal, Bytes } from "@graphprotocol/graph-ts";
  
  function formatDate(timestamp: BigInt): string {
    let unixTimestamp = timestamp.toI32();
    let secondsPerDay = 86400;
    let daysSinceEpoch = unixTimestamp / secondsPerDay;
    
    // Calculate year, month, day
    let year = 1970;
    let daysInYear = 365;
    
    while (daysSinceEpoch >= daysInYear) {
      daysSinceEpoch -= daysInYear;
      year++;
      // Simplified leap year logic
      daysInYear = (year % 4 == 0) ? 366 : 365;
    }
    
    let daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
    if (year % 4 == 0) daysInMonth[1] = 29;
    
    let month = 0;
    while (daysSinceEpoch >= daysInMonth[month]) {
      daysSinceEpoch -= daysInMonth[month];
      month++;
    }
    
    let day = daysSinceEpoch + 1;
    
    return year.toString() + '-' + 
           (month + 1).toString().padStart(2, '0') + '-' + 
           day.toString().padStart(2, '0');
  }
  
  function getWeekNumber(timestamp: BigInt): string {
    let unixTimestamp = timestamp.toI32();
    let daysSinceEpoch = unixTimestamp / 86400;
    let weekNumber = (daysSinceEpoch / 7) + 1;
    let year = 1970 + (daysSinceEpoch / 365);
    
    return year.toString() + '-' + weekNumber.toString().padStart(2, '0');
  }
  
  function loadOrCreateToken(): Token {
    let token = Token.load("1");
    if (token == null) {
      token = new Token("1");
      let contract = TetherToken.bind(Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7"));
      token.name = contract.name();
      token.symbol = contract.symbol();
      token.decimals = contract.decimals().toI32();
      token.totalSupply = contract.totalSupply();
      token.owner = contract.getOwner();
      token.paused = contract.paused();
      token.deprecated = contract.deprecated();
      token.basisPointsRate = contract.basisPointsRate().toI32();
      token.maximumFee = contract.maximumFee();
      token.issuanceCount = BigInt.fromI32(0);
      token.redeemCount = BigInt.fromI32(0);
      token.blacklistedCount = BigInt.fromI32(0);
      token.paramChangeCount = BigInt.fromI32(0);
      token.save();
    }
    return token;
  }


  function loadOrCreateAccount(address: Address, timestamp: BigInt): Account {
    let account = Account.load(address.toHexString());
    if (account == null) {
      account = new Account(address.toHexString());
      account.address = address;
      account.balance = BigInt.fromI32(0);
      account.isBlacklisted = false;
      account.transferCount = BigInt.fromI32(0);
      account.receivedCount = BigInt.fromI32(0);
      account.totalTransferred = BigInt.fromI32(0);
      account.totalReceived = BigInt.fromI32(0);
      account.totalFeesPaid = BigInt.fromI32(0);
      account.firstTransactionTimestamp = timestamp;
      account.lastTransactionTimestamp = timestamp;
      account.save();
    }
    return account;
  }
  
  function loadOrCreateDailyMetric(timestamp: BigInt): DailyMetric {
    let dateString = formatDate(timestamp);
    let metric = DailyMetric.load(dateString);
    
    if (metric == null) {
      metric = new DailyMetric(dateString);
      metric.timestamp = timestamp;
      metric.totalTransfers = BigInt.fromI32(0);
      metric.totalTransferValue = BigInt.fromI32(0);
      metric.totalFees = BigInt.fromI32(0);
      metric.uniqueSenders = BigInt.fromI32(0);
      metric.uniqueReceivers = BigInt.fromI32(0);
      metric.activeAccounts = BigInt.fromI32(0);
      metric.averageTransferAmount = BigDecimal.fromString("0");
      metric.maxTransferAmount = BigInt.fromI32(0);
      metric.minTransferAmount = BigInt.fromI32(2147483647);
      metric.newAccounts = BigInt.fromI32(0);
      metric.blacklistedAccounts = BigInt.fromI32(0);
      metric.hasFeeIncrease = false;
      metric.hasFeeDecrease = false;
      metric.volume = BigInt.fromI32(0);
      metric.fee = BigInt.fromI32(0);
      metric.transferCount = BigInt.fromI32(0);
      metric.save();
    }
    return metric;
  }
  
  function loadOrCreateUserDailyMetric(account: Account, timestamp: BigInt): UserDailyMetric {
    let dateString = formatDate(timestamp);
    let id = account.id + "-" + dateString;
    let metric = UserDailyMetric.load(id);
    
    if (metric == null) {
      metric = new UserDailyMetric(id);
      metric.user = account.id;
      metric.timestamp = timestamp;
      metric.date = dateString;
      metric.transferCount = BigInt.fromI32(0);
      metric.receivedCount = BigInt.fromI32(0);
      metric.totalTransferred = BigInt.fromI32(0);
      metric.totalReceived = BigInt.fromI32(0);
      metric.feesPaid = BigInt.fromI32(0);
      metric.endDayBalance = account.balance;
      metric.averageTransferAmount = BigDecimal.fromString("0");
      metric.maxTransferAmount = BigInt.fromI32(0);
      metric.distinctReceivers = BigInt.fromI32(0);
      metric.distinctSenders = BigInt.fromI32(0);
      metric.save();
    }
    return metric;
  }
  
  function loadOrCreateWeeklyMetric(timestamp: BigInt): WeeklyMetric {
    let weekId = getWeekNumber(timestamp);
    let metric = WeeklyMetric.load(weekId);
    
    if (metric == null) {
      metric = new WeeklyMetric(weekId);
      metric.weekNumber = BigInt.fromI32(parseInt(weekId.split('-')[1]) as i32);
      metric.year = BigInt.fromI32(parseInt(weekId.split('-')[0]) as i32);
      metric.timestamp = timestamp;
      metric.totalTransfers = BigInt.fromI32(0);
      metric.totalTransferValue = BigInt.fromI32(0);
      metric.totalFees = BigInt.fromI32(0);
      metric.activeAccounts = BigInt.fromI32(0);
      metric.averageTransferAmount = BigDecimal.fromString("0");
      metric.volume = BigInt.fromI32(0);
      metric.fee = BigInt.fromI32(0);
      metric.transferCount = BigInt.fromI32(0);
      metric.save();
    }
    return metric;
  }
  
  export function handleTransfer(event: TransferEvent): void {
    let token = loadOrCreateToken();
    let fromAccount = loadOrCreateAccount(event.params.from, event.block.timestamp);
    let toAccount = loadOrCreateAccount(event.params.to, event.block.timestamp);
    let dateString = formatDate(event.block.timestamp);
    
    // Create transfer entity
    let transfer = new Transfer(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
    transfer.from = fromAccount.id;
    transfer.to = toAccount.id;
    transfer.value = event.params.value;
    transfer.timestamp = event.block.timestamp;
    transfer.date = dateString;
    transfer.block = event.block.number;
    transfer.transactionHash = event.transaction.hash;
  
    // Calculate fee
    let basisPoints = BigInt.fromI32(token.basisPointsRate);
    let fee = event.params.value.times(basisPoints).div(BigInt.fromI32(10000));
    if (fee.gt(token.maximumFee)) {
      fee = token.maximumFee;
    }
    transfer.fee = fee;
    transfer.save();
  
    // Update account metrics
    fromAccount.transferCount = fromAccount.transferCount.plus(BigInt.fromI32(1));
    fromAccount.totalTransferred = fromAccount.totalTransferred.plus(event.params.value);
    fromAccount.totalFeesPaid = fromAccount.totalFeesPaid.plus(fee);
    fromAccount.lastTransactionTimestamp = event.block.timestamp;
    fromAccount.balance = fromAccount.balance.minus(event.params.value);
    fromAccount.save();
  
    toAccount.receivedCount = toAccount.receivedCount.plus(BigInt.fromI32(1));
    toAccount.totalReceived = toAccount.totalReceived.plus(event.params.value.minus(fee));
    toAccount.lastTransactionTimestamp = event.block.timestamp;
    toAccount.balance = toAccount.balance.plus(event.params.value.minus(fee));
    toAccount.save();
  
    // Update daily metrics
    let dailyMetric = loadOrCreateDailyMetric(event.block.timestamp);
    updateDailyMetrics(dailyMetric, transfer, fromAccount, toAccount);
  
    // Update weekly metrics
    let weeklyMetric = loadOrCreateWeeklyMetric(event.block.timestamp);
    updateWeeklyMetrics(weeklyMetric, transfer);
  
    // Update user daily metrics
    updateUserDailyMetrics(fromAccount, toAccount, transfer, event.block.timestamp);
  }
  
  function updateDailyMetrics(dailyMetric: DailyMetric, transfer: Transfer, fromAccount: Account, toAccount: Account): void {
    dailyMetric.totalTransfers = dailyMetric.totalTransfers.plus(BigInt.fromI32(1));
    dailyMetric.totalTransferValue = dailyMetric.totalTransferValue.plus(transfer.value);
    dailyMetric.totalFees = dailyMetric.totalFees.plus(transfer.fee);
    
    // Update volume aliases
    dailyMetric.volume = dailyMetric.totalTransferValue;
    dailyMetric.fee = dailyMetric.totalFees;
    dailyMetric.transferCount = dailyMetric.totalTransfers;
    
    if (dailyMetric.maxTransferAmount.lt(transfer.value)) {
      dailyMetric.maxTransferAmount = transfer.value;
    }
    if (dailyMetric.minTransferAmount.gt(transfer.value)) {
      dailyMetric.minTransferAmount = transfer.value;
    }
    
    let avgAmount = dailyMetric.totalTransferValue
      .toBigDecimal()
      .div(dailyMetric.totalTransfers.toBigDecimal());
    dailyMetric.averageTransferAmount = avgAmount;
    
    // Increment active accounts count if this is their first transaction of the day
    if (fromAccount.lastTransactionTimestamp == transfer.timestamp) {
      dailyMetric.activeAccounts = dailyMetric.activeAccounts.plus(BigInt.fromI32(1));
    }
    if (toAccount.lastTransactionTimestamp == transfer.timestamp) {
      dailyMetric.activeAccounts = dailyMetric.activeAccounts.plus(BigInt.fromI32(1));
    }
    
    dailyMetric.save();
  }
  
  function updateWeeklyMetrics(weeklyMetric: WeeklyMetric, transfer: Transfer): void {
    weeklyMetric.totalTransfers = weeklyMetric.totalTransfers.plus(BigInt.fromI32(1));
    weeklyMetric.totalTransferValue = weeklyMetric.totalTransferValue.plus(transfer.value);
    weeklyMetric.totalFees = weeklyMetric.totalFees.plus(transfer.fee);
    
    // Update volume aliases
    weeklyMetric.volume = weeklyMetric.totalTransferValue;
    weeklyMetric.fee = weeklyMetric.totalFees;
    weeklyMetric.transferCount = weeklyMetric.totalTransfers;
    
    let avgAmount = weeklyMetric.totalTransferValue
      .toBigDecimal()
      .div(weeklyMetric.totalTransfers.toBigDecimal());
    weeklyMetric.averageTransferAmount = avgAmount;
    
    weeklyMetric.save();
  }



  function updateUserDailyMetrics(fromAccount: Account, toAccount: Account, transfer: Transfer, timestamp: BigInt): void {
    let fromMetric = loadOrCreateUserDailyMetric(fromAccount, timestamp);
    let toMetric = loadOrCreateUserDailyMetric(toAccount, timestamp);
    
    fromMetric.transferCount = fromMetric.transferCount.plus(BigInt.fromI32(1));
    fromMetric.totalTransferred = fromMetric.totalTransferred.plus(transfer.value);
    fromMetric.feesPaid = fromMetric.feesPaid.plus(transfer.fee);
    fromMetric.endDayBalance = fromAccount.balance;
    
    if (fromMetric.maxTransferAmount.lt(transfer.value)) {
      fromMetric.maxTransferAmount = transfer.value;
    }
    
    if (!fromMetric.totalTransferred.isZero()) {
      let fromAvgTransfer = fromMetric.totalTransferred
        .toBigDecimal()
        .div(fromMetric.transferCount.toBigDecimal());
      fromMetric.averageTransferAmount = fromAvgTransfer;
    }
    
    // Update distinct receivers count
    fromMetric.distinctReceivers = fromMetric.distinctReceivers.plus(BigInt.fromI32(1));
    fromMetric.save();
  
    toMetric.receivedCount = toMetric.receivedCount.plus(BigInt.fromI32(1));
    toMetric.totalReceived = toMetric.totalReceived.plus(transfer.value.minus(transfer.fee));
    toMetric.endDayBalance = toAccount.balance;
    
    // Update distinct senders count
    toMetric.distinctSenders = toMetric.distinctSenders.plus(BigInt.fromI32(1));
    toMetric.save();
  }
  
  export function handleApproval(event: ApprovalEvent): void {
    let ownerAccount = loadOrCreateAccount(event.params.owner, event.block.timestamp);
    let spenderAccount = loadOrCreateAccount(event.params.spender, event.block.timestamp);
  
    let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let approval = new Approval(id);
    approval.owner = ownerAccount.id;
    approval.spender = spenderAccount.id;
    approval.value = event.params.value;
    approval.timestamp = event.block.timestamp;
    approval.block = event.block.number;
    approval.transactionHash = event.transaction.hash;
    approval.save();
  }
  
  export function handleIssue(event: IssueEvent): void {
    let token = loadOrCreateToken();
    token.totalSupply = token.totalSupply.plus(event.params.amount);
    token.issuanceCount = token.issuanceCount.plus(BigInt.fromI32(1));
    token.save();
  
    let contract = TetherToken.bind(Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7"));
    let ownerAddress = contract.getOwner();
    let ownerAccount = loadOrCreateAccount(ownerAddress, event.block.timestamp);
    
    // Update owner balance
    ownerAccount.balance = ownerAccount.balance.plus(event.params.amount);
    ownerAccount.lastTransactionTimestamp = event.block.timestamp;
    ownerAccount.save();
  
    // Update daily metrics
    let dailyMetric = loadOrCreateDailyMetric(event.block.timestamp);
    dailyMetric.totalTransferValue = dailyMetric.totalTransferValue.plus(event.params.amount);
    dailyMetric.volume = dailyMetric.totalTransferValue;
    dailyMetric.save();
  
    // Update user daily metrics
    let userDailyMetric = loadOrCreateUserDailyMetric(ownerAccount, event.block.timestamp);
    userDailyMetric.receivedCount = userDailyMetric.receivedCount.plus(BigInt.fromI32(1));
    userDailyMetric.totalReceived = userDailyMetric.totalReceived.plus(event.params.amount);
    userDailyMetric.endDayBalance = ownerAccount.balance;
    userDailyMetric.save();
  }
  
  export function handleRedeem(event: RedeemEvent): void {
    let token = loadOrCreateToken();
    token.totalSupply = token.totalSupply.minus(event.params.amount);
    token.redeemCount = token.redeemCount.plus(BigInt.fromI32(1));
    token.save();
  
    let contract = TetherToken.bind(Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7"));
    let ownerAddress = contract.getOwner();
    let ownerAccount = loadOrCreateAccount(ownerAddress, event.block.timestamp);
    
    // Update owner balance
    ownerAccount.balance = ownerAccount.balance.minus(event.params.amount);
    ownerAccount.lastTransactionTimestamp = event.block.timestamp;
    ownerAccount.save();
  
    // Update daily metrics
    let dailyMetric = loadOrCreateDailyMetric(event.block.timestamp);
    dailyMetric.totalTransferValue = dailyMetric.totalTransferValue.plus(event.params.amount);
    dailyMetric.volume = dailyMetric.totalTransferValue;
    dailyMetric.save();
  
    // Update user daily metrics
    let userDailyMetric = loadOrCreateUserDailyMetric(ownerAccount, event.block.timestamp);
    userDailyMetric.transferCount = userDailyMetric.transferCount.plus(BigInt.fromI32(1));
    userDailyMetric.totalTransferred = userDailyMetric.totalTransferred.plus(event.params.amount);
    userDailyMetric.endDayBalance = ownerAccount.balance;
    userDailyMetric.save();
  }
  
  export function handleAddedBlackList(event: AddedBlackListEvent): void {
    let account = loadOrCreateAccount(event.params._user, event.block.timestamp);
    account.isBlacklisted = true;
    account.save();
  
    let token = loadOrCreateToken();
    token.blacklistedCount = token.blacklistedCount.plus(BigInt.fromI32(1));
    token.save();
  
    // Create BlacklistAction entity
    let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let blacklistAction = new BlacklistAction(id);
    blacklistAction.user = account.id;
    blacklistAction.actionType = "ADD";
    blacklistAction.timestamp = event.block.timestamp;
    blacklistAction.block = event.block.number;
    blacklistAction.transactionHash = event.transaction.hash;
    blacklistAction.save();
  
    // Update daily metrics
    let dailyMetric = loadOrCreateDailyMetric(event.block.timestamp);
    dailyMetric.blacklistedAccounts = dailyMetric.blacklistedAccounts.plus(BigInt.fromI32(1));
    dailyMetric.save();
  }
  
  export function handleRemovedBlackList(event: RemovedBlackListEvent): void {
    let account = loadOrCreateAccount(event.params._user, event.block.timestamp);
    account.isBlacklisted = false;
    account.save();
  
    let token = loadOrCreateToken();
    token.blacklistedCount = token.blacklistedCount.minus(BigInt.fromI32(1));
    token.save();
  
    // Create BlacklistAction entity
    let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let blacklistAction = new BlacklistAction(id);
    blacklistAction.user = account.id;
    blacklistAction.actionType = "REMOVE";
    blacklistAction.timestamp = event.block.timestamp;
    blacklistAction.block = event.block.number;
    blacklistAction.transactionHash = event.transaction.hash;
    blacklistAction.save();
  
    // Update daily metrics
    let dailyMetric = loadOrCreateDailyMetric(event.block.timestamp);
    dailyMetric.blacklistedAccounts = dailyMetric.blacklistedAccounts.minus(BigInt.fromI32(1));
    dailyMetric.save();
  }
  
  export function handleParams(event: ParamsEvent): void {
    let token = loadOrCreateToken();
    
    // Create parameter change record
    let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let paramChange = new ParamChange(id);
    paramChange.token = token.id;
    paramChange.timestamp = event.block.timestamp;
    paramChange.blockNumber = event.block.number;
    paramChange.oldBasisPoints = token.basisPointsRate;
    paramChange.newBasisPoints = event.params.feeBasisPoints.toI32();
    paramChange.oldMaxFee = token.maximumFee;
    paramChange.newMaxFee = event.params.maxFee;
    paramChange.transactionHash = event.transaction.hash;
    paramChange.save();
  
    // Update token parameters
    token.basisPointsRate = event.params.feeBasisPoints.toI32();
    token.maximumFee = event.params.maxFee;
    token.paramChangeCount = token.paramChangeCount.plus(BigInt.fromI32(1));
    token.save();
  
    // Update daily metrics
    let dailyMetric = loadOrCreateDailyMetric(event.block.timestamp);
    let basisPointsChange = event.params.feeBasisPoints.toI32() - token.basisPointsRate;
    let maxFeeChange = event.params.maxFee.minus(token.maximumFee);
    
    if (basisPointsChange > 0 || maxFeeChange.gt(BigInt.fromI32(0))) {
      dailyMetric.hasFeeIncrease = true;
    } else if (basisPointsChange < 0 || maxFeeChange.lt(BigInt.fromI32(0))) {
      dailyMetric.hasFeeDecrease = true;
    }
    dailyMetric.save();
  }  