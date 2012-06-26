/// <reference path="knockout-2.1.0.debug.js" />
/// <reference path="jquery-1.7.2.js" />
/// <reference path="jquery.signalR-0.5.1.js" />

var Blackjack = {};

Blackjack.Game = function() {

    var self = this;

    this.inPlay = ko.observable(false);
    this.inGame = ko.observable(false);

    this.dealer = ko.observable(new Blackjack.Player());
    this.players = ko.observableArray([]);

    this.currentIndex = ko.observable();
    this.yourIndex = ko.observable();

    this.currentPlayer = ko.observable();


    this.join = function() {
        $.connection.gameHub.join();
    };

    $.connection.gameHub.playerJoined = function(num, id) {
        var curr = self.players().length;

        for (var i = curr; i < num; i++) {
            self.players.push(new Blackjack.Player(i));
        }

        if (id === $.connection.hub.id) {
            self.yourIndex(num - 1);
            self.inGame(true);
        }
    };


    $.connection.gameHub.playerDisconnected = function(num) {
        self.players()[num].disconnected(true);

        if (self.currentIndex() === num)
            _nextPlayer();
    };

    $.connection.gameHub.clear = function() {
        self.dealer().clear();
        ko.utils.arrayForEach(self.players(), function(player) {
            player.clear();
        });
    };

    $.connection.gameHub.dealCard = function(index, rank, suit, facedown) {
        var hand = self.dealer().hand;
        if (index != null)
            hand = self.players()[index].hand;

        hand.push(new Blackjack.Card(rank, suit, facedown));
    };

    $.connection.gameHub.inPlay = function(val) {
        self.inPlay(val);
    };

    $.connection.gameHub.nextPlayer = function() {
        _nextPlayer();
    };

    $.connection.gameHub.evalWinners = function() {
        _evalWinners();
    };

    this.deal = function() {
        $.connection.gameHub.deal();
    };

    this.hit = function() {
        $.connection.gameHub.hit(self.currentIndex(), self.currentPlayer().total());
    };


    this.stay = function() {
        $.connection.gameHub.stay();
    };

    function _nextPlayer() {
        if (self.players().length === 0)
            return;

        var idx = self.currentIndex();

        if (idx === undefined)
            idx = -1;

        idx++;

        while (idx < self.players().length && self.players()[idx].disconnected() == true) {
            idx++;
        }

        if (idx < self.players().length) {
            self.currentIndex(idx);
            self.currentPlayer(self.players()[idx]);
        }
        else {
            self.currentIndex(undefined);
            self.currentPlayer(undefined);
            _dealerFinish();
        }
    }

    function _dealerFinish() {
        var dealer = self.dealer();
        dealer.hand()[0].facedown(false);

        $.connection.gameHub.dealerFinish(dealer.total());
    }

    function _evalWinners() {

        var dealer = self.dealer();

        ko.utils.arrayForEach(self.players(), function(p) {
            if (p.total() > 21) {
                p.status("Bust");
                return;
            }

            if (dealer.total() > 21) {
                p.status("Winner");
                p.winner(true);
                return;
            }

            if (p.total() === dealer.total()) {
                p.status("Push");
                return;
            }

            if (p.total() > dealer.total()) {
                p.status("Winner");
                p.winner(true);
                return;
            }

            p.status("Lose");

        });

        self.inPlay(false);
    }
}

Blackjack.Player = function(playerNumber) {
    var self = this;

    this.playerNumber = ko.observable(playerNumber);
    this.hand = ko.observableArray([]);
    this.status = ko.observable();
    this.winner = ko.observable(false);
    this.disconnected = ko.observable(false);

    this.clear = function() {
        this.hand([]);
        this.status(undefined);
        this.winner(false);
    };

    this.total = ko.computed(function() {
        var sum = 0;
        var numAces = 0;
        ko.utils.arrayForEach(self.hand(), function(card) {
            sum += card.value();
            if (card.rank === 'A')
                numAces++
        });

        if (sum > 21) {
            for (var i = 0; i < numAces; i++) {
                sum -= 10;
                if (sum <= 21)
                    break;
            }
        }

        return sum;
    });

    this.total.subscribe(function(t) {
        if (t === 21 && self.hand().length == 2) {
            self.status("Blackjack!");
            self.winner(true);
            self.hand()[0].facedown(false);
        }
    });
}

Blackjack.Card = function(rank, suit, facedown) {
    var self = this;

    this.rank = rank;
    this.suit = suit;
    this.facedown = ko.observable(facedown);

    this.value = ko.computed(function() {
        if (self.facedown())
            return 0;

        var val = 0;

        if (self.rank === 'A')
            val = 11;
        else if ('TJQK'.indexOf(self.rank) !== -1)
            val = 10;
        else if ('23456789'.indexOf(self.rank) !== -1)
            val = parseInt(self.rank);

        return val;
    });

    this.imageName = ko.computed(function() {
        if (self.facedown())
            return "b2fv.png";
        else
            return self.suit + self.rank + ".png";
    });

    this.toString = function() { return self.rank + self.suit; }
};