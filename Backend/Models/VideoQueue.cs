namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Representa la cola de videos de una sala con su configuración
    /// </summary>
    public class VideoQueue
    {
        private readonly List<QueueItem> _items = new();
        private readonly object _lock = new();

        /// <summary>
        /// Si es true, avanza automáticamente al siguiente video cuando termina el actual
        /// </summary>
        public bool AutoAdvance { get; set; } = true;

        /// <summary>
        /// Índice del video que se está reproduciendo actualmente (-1 si ninguno)
        /// </summary>
        public int CurrentIndex { get; set; } = -1;

        /// <summary>
        /// Obtiene una copia de la lista de items
        /// </summary>
        public List<QueueItem> GetItems()
        {
            lock (_lock)
            {
                return _items.ToList();
            }
        }

        /// <summary>
        /// Obtiene el item actual (en reproducción)
        /// </summary>
        public QueueItem? GetCurrentItem()
        {
            lock (_lock)
            {
                if (CurrentIndex >= 0 && CurrentIndex < _items.Count)
                {
                    return _items[CurrentIndex];
                }
                return null;
            }
        }

        /// <summary>
        /// Obtiene el siguiente item en la cola
        /// </summary>
        public QueueItem? GetNextItem()
        {
            lock (_lock)
            {
                var nextIndex = CurrentIndex + 1;
                if (nextIndex >= 0 && nextIndex < _items.Count)
                {
                    return _items[nextIndex];
                }
                return null;
            }
        }

        /// <summary>
        /// Agrega un item a la cola
        /// </summary>
        public void AddItem(QueueItem item)
        {
            lock (_lock)
            {
                item.Position = _items.Count;
                _items.Add(item);
            }
        }

        /// <summary>
        /// Remueve un item de la cola por ID
        /// </summary>
        public bool RemoveItem(string itemId)
        {
            lock (_lock)
            {
                var item = _items.FirstOrDefault(i => i.ItemId == itemId);
                if (item == null) return false;

                var removedPosition = item.Position;
                _items.Remove(item);

                // Actualizar posiciones
                foreach (var i in _items.Where(i => i.Position > removedPosition))
                {
                    i.Position--;
                }

                // Ajustar CurrentIndex si es necesario
                if (CurrentIndex >= _items.Count)
                {
                    CurrentIndex = _items.Count - 1;
                }
                else if (removedPosition < CurrentIndex)
                {
                    CurrentIndex--;
                }

                return true;
            }
        }

        /// <summary>
        /// Reordena la cola según una lista de IDs
        /// </summary>
        public bool Reorder(List<string> itemIds)
        {
            lock (_lock)
            {
                if (itemIds.Count != _items.Count)
                    return false;

                var currentItemId = CurrentIndex >= 0 && CurrentIndex < _items.Count
                    ? _items[CurrentIndex].ItemId
                    : null;

                var newItems = new List<QueueItem>();
                for (int i = 0; i < itemIds.Count; i++)
                {
                    var item = _items.FirstOrDefault(x => x.ItemId == itemIds[i]);
                    if (item == null) return false;
                    item.Position = i;
                    newItems.Add(item);
                }

                _items.Clear();
                _items.AddRange(newItems);

                // Actualizar CurrentIndex para mantener el video actual
                if (currentItemId != null)
                {
                    CurrentIndex = _items.FindIndex(i => i.ItemId == currentItemId);
                }

                return true;
            }
        }

        /// <summary>
        /// Avanza al siguiente video en la cola
        /// </summary>
        public QueueItem? AdvanceToNext()
        {
            lock (_lock)
            {
                var nextIndex = CurrentIndex + 1;
                if (nextIndex >= 0 && nextIndex < _items.Count)
                {
                    CurrentIndex = nextIndex;
                    return _items[CurrentIndex];
                }
                return null;
            }
        }

        /// <summary>
        /// Avanza a un item específico por ID
        /// </summary>
        public QueueItem? AdvanceToItem(string itemId)
        {
            lock (_lock)
            {
                var index = _items.FindIndex(i => i.ItemId == itemId);
                if (index >= 0)
                {
                    CurrentIndex = index;
                    return _items[index];
                }
                return null;
            }
        }

        /// <summary>
        /// Busca un item por ID
        /// </summary>
        public QueueItem? FindItem(string itemId)
        {
            lock (_lock)
            {
                return _items.FirstOrDefault(i => i.ItemId == itemId);
            }
        }

        /// <summary>
        /// Obtiene items programados que deben reproducirse
        /// </summary>
        public List<QueueItem> GetScheduledItemsDue()
        {
            lock (_lock)
            {
                var now = DateTime.UtcNow;
                return _items
                    .Where(i => i.ScheduledAtUtc.HasValue &&
                                i.ScheduledAtUtc.Value <= now &&
                                i.Position > CurrentIndex)
                    .OrderBy(i => i.ScheduledAtUtc)
                    .ToList();
            }
        }

        /// <summary>
        /// Verifica si la cola está vacía
        /// </summary>
        public bool IsEmpty()
        {
            lock (_lock)
            {
                return _items.Count == 0;
            }
        }

        /// <summary>
        /// Verifica si la cola está agotada (no hay más videos por reproducir)
        /// </summary>
        public bool IsExhausted()
        {
            lock (_lock)
            {
                return CurrentIndex >= _items.Count - 1;
            }
        }

        /// <summary>
        /// Obtiene la cantidad de items en la cola
        /// </summary>
        public int Count
        {
            get
            {
                lock (_lock)
                {
                    return _items.Count;
                }
            }
        }
    }
}
