export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-4">Tailwind CSS Test Page</h1>

      {/* Basic color tests */}
      <div className="space-y-4">
        <div className="p-4 bg-red-500 text-white">
          Red background with white text
        </div>

        <div className="p-4 bg-blue-500 text-yellow-300">
          Blue background with yellow text
        </div>

        <div className="p-4 bg-green-500 text-black">
          Green background with black text
        </div>

        {/* Grid test */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-200 p-4 rounded">Grid 1</div>
          <div className="bg-gray-300 p-4 rounded">Grid 2</div>
          <div className="bg-gray-400 p-4 rounded">Grid 3</div>
        </div>

        {/* Shadow test */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          Card with shadow
        </div>

        {/* Gradient test */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded">
          Gradient background
        </div>

        {/* Hover test */}
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
          Hover me
        </button>
      </div>

      {/* Raw CSS test */}
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'red', color: 'white' }}>
        This uses inline styles - should be red with white text regardless of Tailwind
      </div>
    </div>
  )
}