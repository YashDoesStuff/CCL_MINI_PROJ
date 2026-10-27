import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import SlotCard from './SlotCard';
import styles from './DragDropWrapper.module.css';
import api from '../api/axios';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

/**
 * DragDropWrapper — admin-only drag-drop timetable editor
 *
 * Props:
 *   slots        — array of slot objects
 *   timetableId  — MongoDB _id of the timetable document
 *   onSlotsChange — callback(newSlots) to sync parent state after successful drop
 *   onCancel     — callback(slot) for cancel button on SlotCard
 *   onAssign     — callback(slot) for assign button on SlotCard
 */
export default function DragDropWrapper({
  slots = [],
  timetableId,
  onSlotsChange,
  onCancel,
  onAssign,
}) {
  const [localSlots, setLocalSlots] = useState(slots);
  const [error, setError] = useState('');

  // Sync when parent passes new slots (e.g. after generate)
  if (slots !== localSlots && slots.length !== localSlots.length) {
    setLocalSlots(slots);
  }

  const slotMap = {};
  localSlots.forEach((slot) => {
    const key = `${slot.day}-${slot.time}`;
    slotMap[key] = slot;
  });

  const onDragEnd = useCallback(
    async (result) => {
      const { source, destination, draggableId } = result;
      if (!destination || source.droppableId === destination.droppableId) return;

      const srcKey = source.droppableId;       // "Monday-9:00"
      const dstKey = destination.droppableId;  // "Tuesday-10:00"
      const [dstDay, dstTime] = dstKey.split('-');

      // Find the dragged slot
      const movedSlot = localSlots.find((s) => s._id === draggableId);
      if (!movedSlot) return;

      // Optimistic update
      const updated = localSlots.map((s) =>
        s._id === draggableId ? { ...s, day: dstDay, time: dstTime } : s
      );
      setLocalSlots(updated);
      setError('');

      try {
        const res = await api.put('/timetable/update-slot', {
          timetableId,
          slotId: movedSlot._id,
          updates: { day: dstDay, time: dstTime },
        });

        if (!res.data.success) {
          // Revert on logical failure
          setLocalSlots(localSlots);
          setError(res.data.message || 'Conflict detected — slot reverted.');
          return;
        }

        onSlotsChange && onSlotsChange(updated);
      } catch (err) {
        // Revert on network/server error
        setLocalSlots(localSlots);
        setError(
          err.response?.data?.message || 'Failed to update slot — change reverted.'
        );
      }
    },
    [localSlots, timetableId, onSlotsChange]
  );

  return (
    <div className={styles.wrapper}>
      {error && (
        <div className={styles.errorBanner}>
          ⚠️ {error}
          <button className={styles.errorClose} onClick={() => setError('')}>×</button>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className={styles.grid}>
          {/* Day headers */}
          <div className={styles.cornerCell} />
          {DAYS.map((day) => (
            <div key={day} className={styles.dayHeader}>{day}</div>
          ))}

          {/* Time rows */}
          {TIME_SLOTS.map((time) => (
            <>
              <div key={`tl-${time}`} className={styles.timeLabel}>{time}</div>
              {DAYS.map((day) => {
                const key = `${day}-${time}`;
                const slot = slotMap[key];
                return (
                  <Droppable key={key} droppableId={key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${styles.cell} ${snapshot.isDraggingOver ? styles.cellOver : ''} ${
                          slot ? styles[`cell_${slot.status}`] : styles.cellEmpty
                        }`}
                      >
                        {slot ? (
                          <Draggable draggableId={slot._id} index={0}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`${styles.draggable} ${dragSnapshot.isDragging ? styles.dragging : ''}`}
                              >
                                <SlotCard
                                  slot={slot}
                                  role="admin"
                                  onCancel={onCancel}
                                  draggable
                                />
                                {onAssign && slot.status === 'open' && (
                                  <button
                                    className={styles.assignBtn}
                                    onClick={(e) => { e.stopPropagation(); onAssign(slot); }}
                                  >
                                    Assign Faculty
                                  </button>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ) : (
                          <span className={styles.emptyLabel}>Drop here</span>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
