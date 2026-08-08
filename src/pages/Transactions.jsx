import { useState } from 'react'
import { useTransactionsData } from '../hooks/useTransactionsData'
import TransactionList from '../components/TransactionList'
import TransactionModal, { TaskCompleteDialog } from '../components/TransactionModal'

const TYPE_TABS = [
  { id: 'all', label: 'Vše' },
  { id: 'BUY', label: 'BUY' },
  { id: 'SELL', label: 'SELL' },
  { id: 'DIVIDEND', label: 'DIVIDEND' },
]

const ACCOUNT_TABS = [
  { id: 'all', label: 'Vše' },
  { id: 'xtb', label: 'XTB' },
  { id: 'fio', label: 'FIO' },
  { id: 'dip', label: 'DIP' },
]

const PORTFOLIO_TABS = [
  { id: 'libor', label: 'Libor' },
  { id: 'eda', label: 'Eda' },
]

function PillTabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-[#2563eb] text-white'
                : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Transactions() {
  const {
    loading,
    error,
    reload,
    transactions,
    hasMore,
    loadMore,
    counts,
    typeFilter,
    setTypeFilter,
    accountFilter,
    setAccountFilter,
    portfolioFilter,
    setPortfolioFilter,
    addTransaction,
    editTransaction,
    removeTransaction,
    completeTask,
  } = useTransactionsData()

  const [modalMode, setModalMode] = useState(null) // 'new' | 'edit'
  const [editTx, setEditTx] = useState(null)
  const [taskPrompt, setTaskPrompt] = useState(null)
  const [taskBusy, setTaskBusy] = useState(false)

  const openNew = () => {
    setEditTx(null)
    setModalMode('new')
  }

  const openEdit = (tx) => {
    setEditTx(tx)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditTx(null)
  }

  const handleSave = async (payload) => {
    if (modalMode === 'edit' && editTx) {
      await editTransaction(editTx.id, payload)
      closeModal()
      return
    }

    const { matchedTask } = await addTransaction(payload)
    closeModal()
    if (matchedTask) setTaskPrompt(matchedTask)
  }

  const handleDelete = async () => {
    if (!editTx) return
    await removeTransaction(editTx.id)
    closeModal()
  }

  const handleTaskYes = async () => {
    if (!taskPrompt) return
    setTaskBusy(true)
    try {
      await completeTask(taskPrompt.id)
      setTaskPrompt(null)
    } catch (err) {
      alert(err.message || 'Úkol se nepodařilo splnit')
    } finally {
      setTaskBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#94a3b8]">
        Načítám transakce…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-[#dc2626]">
        <p>{error}</p>
        <button type="button" onClick={reload} className="mt-2 underline">
          Zkusit znovu
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-[#0f172a]">Transakce</h1>
        <button
          type="button"
          onClick={openNew}
          className="shrink-0 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-medium text-white"
        >
          + Nová transakce
        </button>
      </div>

      <div className="space-y-2.5">
        <PillTabs tabs={PORTFOLIO_TABS} value={portfolioFilter} onChange={setPortfolioFilter} />
        <PillTabs tabs={TYPE_TABS} value={typeFilter} onChange={setTypeFilter} />
        <PillTabs tabs={ACCOUNT_TABS} value={accountFilter} onChange={setAccountFilter} />
      </div>

      <p className="mt-3 text-xs text-[#94a3b8]">
        Celkem: {counts.total} transakcí · {counts.BUY} nákupů · {counts.SELL} prodejů ·{' '}
        {counts.DIVIDEND} dividend
      </p>

      <section className="mt-2">
        <TransactionList transactions={transactions} onSelect={openEdit} />
      </section>

      {hasMore && (
        <div className="mt-4 pb-2 text-center">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#2563eb] hover:bg-slate-50"
          >
            Načíst starší
          </button>
        </div>
      )}

      {modalMode && (
        <TransactionModal
          tx={modalMode === 'edit' ? editTx : null}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={modalMode === 'edit' ? handleDelete : undefined}
        />
      )}

      {taskPrompt && (
        <TaskCompleteDialog
          task={taskPrompt}
          busy={taskBusy}
          onCancel={() => !taskBusy && setTaskPrompt(null)}
          onConfirm={handleTaskYes}
        />
      )}
    </div>
  )
}
