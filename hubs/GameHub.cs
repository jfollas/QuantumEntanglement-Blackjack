using System;
using System.Collections.Generic;
using System.Linq;
using SignalR.Hubs;

namespace CardGame.hubs
{
    public class GameHub : Hub, IDisconnect
    {
        // Application state. Likely a database in a real system.
        private static readonly Dictionary<string, int> playerConnections = new Dictionary<string, int>();
        private static readonly GameState gameState = new GameState();

        public void Join()
        {
            if (!gameState.InPlay)
            {
                int numPlayers = 0;

                lock (playerConnections)
                {
                    numPlayers = playerConnections.Keys.Count + 1;
                    playerConnections.Add(Context.ConnectionId, numPlayers - 1);
                }

                Clients.playerJoined(numPlayers, Context.ConnectionId);
            }
        }

        public void Deal()
        {
            if (!gameState.InPlay)
            {
                lock (gameState)
                {
                    if (!gameState.InPlay)
                    {
                        gameState.InPlay = true;

                        int numPlayers = playerConnections.Keys.Count;

                        Clients.clear();

                        RandomCard card;

                        for (int i = 0; i < numPlayers; i++)
                        {
                            card = new RandomCard();
                            Clients.dealCard(i, card.Rank, card.Suit, false);
                            System.Threading.Thread.Sleep(250);
                        }

                        card = new RandomCard();
                        Clients.dealCard(null, card.Rank, card.Suit, true);
                        System.Threading.Thread.Sleep(250);

                        for (int i = 0; i < numPlayers; i++)
                        {
                            card = new RandomCard();
                            Clients.dealCard(i, card.Rank, card.Suit, false);
                            System.Threading.Thread.Sleep(250);
                        }

                        card = new RandomCard();
                        Clients.dealCard(null, card.Rank, card.Suit, false);
                        System.Threading.Thread.Sleep(250);

                        Clients.inPlay(true);
                        Clients.nextPlayer();
                    }
                }
            }
        }

        public void Hit(int idx, int valueBeforeHit, int numAces)
        {
            if (playerConnections.ContainsKey(Context.ConnectionId) && gameState.InPlay)
            {
                var card = new RandomCard();
                Clients.dealCard(idx, card.Rank, card.Suit, false);

                if (valueBeforeHit + card.Value >= 21 && numAces == 0)
                    Clients.nextPlayer();
            }
        }

        public void Stay()
        {
            if (playerConnections.ContainsKey(Context.ConnectionId) && gameState.InPlay)
            {
                Clients.nextPlayer();
            }
        }

        public void DealerFinish(int dealerTotal)
        {
            if (gameState.InPlay && !gameState.DealerFinishing)
            {
                lock (gameState)
                {
                    if (!gameState.DealerFinishing)
                    {
                        gameState.DealerFinishing = true;

                        int numAces = 0;
                        while (dealerTotal < 17)
                        {
                            var card = new RandomCard();
                            Clients.dealCard(null, card.Rank, card.Suit, false);

                            System.Threading.Thread.Sleep(750);

                            if (card.Rank == 'A')
                                numAces++;

                            dealerTotal += card.Value;

                            if (dealerTotal > 21 && numAces > 0)
                            {
                                dealerTotal -= 10;
                                numAces--;
                            }
                        }
                        gameState.DealerFinishing = false;
                        gameState.InPlay = false;

                        Clients.evalWinners();
                    }
                }
            }
        }


        public System.Threading.Tasks.Task Disconnect()
        {
            int index = -1;
            lock (playerConnections)
            {
                if (playerConnections.ContainsKey(Context.ConnectionId))
                {
                    index = playerConnections[Context.ConnectionId];
                    //playerConnections.Remove(Context.ConnectionId);
                }
            }

            if (index != -1)
                Clients.playerDisconnected(index);

            gameState.Disconnections++;
            if (gameState.Disconnections == playerConnections.Keys.Count)
            {
                playerConnections.Clear();
                gameState.Disconnections = 0;
            }

            return null;
        }


        private class RandomCard
        {
            public char Rank;
            public char Suit;

            public RandomCard()
            {
                var random = new System.Random();
                Rank = "A23456789TJQK"[random.Next(13)];
                Suit = "CDSH"[random.Next(4)];
            }

            public int Value
            {
                get
                {
                    if (Rank == 'A')
                        return 11;
                    if ("TJQK".IndexOf(Rank) > -1)
                        return 10;
                    return "??23456789".IndexOf(Rank);
                }
            }
        }

        private class GameState
        {
            public bool InPlay;
            public bool DealerFinishing;
            public int Disconnections;
        }
    }
}