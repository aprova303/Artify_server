const express = require('express')
const app = express()
const cors = require('cors')
const port = 3000

// Enable CORS for cross-origin requests
app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://artify-db:F2S2wOAOULf8UQS3@cluster0.2zhcuwp.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db('artify-db')
    const artworkCollection = db.collection('artworks')
    const favoritesCollection = db.collection('favorites')
    const { ObjectId } = require('mongodb')

    // Get all artworks
    app.get('/arts', async(req,res)=>{
      try {
        const result = await artworkCollection.find().toArray()
        console.log("Arts fetched:", result.length)
        res.send(result)
      } catch(err) {
        console.error("Error fetching arts:", err)
        res.status(500).send({error: "Failed to fetch arts"})
      }
    })

    // Get all public artworks with filters
    app.get('/api/artworks', async(req,res)=>{
      try {
        const visibility = req.query.visibility || 'Public'
        const query = { visibility: visibility }
        const result = await artworkCollection.find(query).toArray()
        res.send({
          success: true,
          data: result
        })
      } catch(err) {
        console.error("Error fetching artworks:", err)
        res.status(500).send({
          success: false,
          error: "Failed to fetch artworks"
        })
      }
    })

    // Get featured artworks - 6 most recent
    app.get('/api/artworks/featured', async(req,res)=>{
      try {
        const result = await artworkCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray()
        console.log("Featured arts fetched:", result.length)
        res.send(result)
      } catch(err) {
        console.error("Error fetching featured arts:", err)
        res.status(500).send({error: "Failed to fetch featured arts"})
      }
    })

    // Get user's artworks
    app.get('/api/artworks/user/:userId', async(req,res)=>{
      try {
        const { userId } = req.params
        const result = await artworkCollection
          .find({ userEmail: userId })
          .sort({ createdAt: -1 })
          .toArray()
        res.send({
          success: true,
          data: result
        })
      } catch(err) {
        console.error("Error fetching user artworks:", err)
        res.status(500).send({
          success: false,
          error: "Failed to fetch user artworks"
        })
      }
    })

    // Get single artwork details
    app.get('/api/artworks/:id', async(req,res)=>{
      try {
        const { id } = req.params
        const result = await artworkCollection.findOne({
          _id: new ObjectId(id)
        })
        if(result) {
          res.send({
            success: true,
            data: result
          })
        } else {
          res.status(404).send({
            success: false,
            error: "Artwork not found"
          })
        }
      } catch(err) {
        console.error("Error fetching artwork details:", err)
        res.status(500).send({
          success: false,
          error: "Failed to fetch artwork details"
        })
      }
    })

    // Like an artwork
    app.post('/api/artworks/:id/like', async(req,res)=>{
      try {
        const { id } = req.params
        const { userId } = req.body
        
        const artwork = await artworkCollection.findOne({
          _id: new ObjectId(id)
        })

        if(!artwork) {
          return res.status(404).send({
            success: false,
            error: "Artwork not found"
          })
        }

        const likedBy = artwork.likedBy || []
        const isLiked = likedBy.includes(userId)

        if(isLiked) {
          // Remove like using $pull and $inc
          await artworkCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $pull: { likedBy: userId },
              $inc: { likesCount: -1 }
            }
          )
        } else {
          // Add like using $push and $inc
          await artworkCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $push: { likedBy: userId },
              $inc: { likesCount: 1 }
            }
          )
        }

        const updatedArtwork = await artworkCollection.findOne({
          _id: new ObjectId(id)
        })

        res.send({
          success: true,
          isLiked: !isLiked,
          likes: updatedArtwork.likesCount || 0
        })
      } catch(err) {
        console.error("Error updating like:", err)
        res.status(500).send({
          success: false,
          error: "Failed to update like"
        })
      }
    })

    // Check if user liked artwork
    app.get('/api/artworks/:id/liked/:userId', async(req,res)=>{
      try {
        const { id, userId } = req.params
        const artwork = await artworkCollection.findOne({
          _id: new ObjectId(id)
        })

        if(!artwork) {
          return res.status(404).send({
            success: false,
            error: "Artwork not found"
          })
        }

        const isLiked = (artwork.likedBy || []).includes(userId)
        res.send({
          success: true,
          isLiked
        })
      } catch(err) {
        console.error("Error checking like status:", err)
        res.status(500).send({
          success: false,
          error: "Failed to check like status"
        })
      }
    })

    // Add to favorites
    app.post('/api/favorites/:artworkId', async(req,res)=>{
      try {
        const { artworkId } = req.params
        const { userId } = req.body

        const favorite = await favoritesCollection.findOne({
          artworkId: new ObjectId(artworkId),
          userId: userId
        })

        if(favorite) {
          await favoritesCollection.deleteOne({
            artworkId: new ObjectId(artworkId),
            userId: userId
          })
          res.send({
            success: true,
            isFavorited: false
          })
        } else {
          const artwork = await artworkCollection.findOne({
            _id: new ObjectId(artworkId)
          })

          await favoritesCollection.insertOne({
            artworkId: new ObjectId(artworkId),
            userId: userId,
            artwork: artwork,
            createdAt: new Date()
          })

          res.send({
            success: true,
            isFavorited: true
          })
        }
      } catch(err) {
        console.error("Error updating favorites:", err)
        res.status(500).send({
          success: false,
          error: "Failed to update favorites"
        })
      }
    })

    // Get user's favorites
    app.get('/api/favorites/user/:userId', async(req,res)=>{
      try {
        const { userId } = req.params
        const result = await favoritesCollection
          .find({ userId: userId })
          .sort({ createdAt: -1 })
          .toArray()

        const favorites = result.map(fav => fav.artwork)
        res.send({
          success: true,
          data: favorites
        })
      } catch(err) {
        console.error("Error fetching favorites:", err)
        res.status(500).send({
          success: false,
          error: "Failed to fetch favorites"
        })
      }
    })

    // Check if artwork is favorited
    app.get('/api/favorites/:artworkId/:userId', async(req,res)=>{
      try {
        const { artworkId, userId } = req.params
        const favorite = await favoritesCollection.findOne({
          artworkId: new ObjectId(artworkId),
          userId: userId
        })

        res.send({
          success: true,
          isFavorited: !!favorite
        })
      } catch(err) {
        console.error("Error checking favorite status:", err)
        res.status(500).send({
          success: false,
          error: "Failed to check favorite status"
        })
      }
    })

    // Count user's artworks
    app.get('/api/users/:userEmail/artworks/count', async(req,res)=>{
      try {
        const { userEmail } = req.params
        const count = await artworkCollection.countDocuments({
          userEmail: userEmail
        })

        res.send({
          success: true,
          count: count
        })
      } catch(err) {
        console.error("Error counting user artworks:", err)
        res.status(500).send({
          success: false,
          error: "Failed to count user artworks"
        })
      }
    })

    // Add new artwork
    app.post('/api/artworks', async(req,res)=>{
      try {
        const artworkData = {
          image: req.body.image,
          title: req.body.title,
          category: req.body.category,
          mediumTools: req.body.mediumTools,
          description: req.body.description,
          dimensions: req.body.dimensions || '',
          price: req.body.price ? parseFloat(req.body.price) : 0,
          visibility: req.body.visibility,
          userName: req.body.userName,
          userEmail: req.body.userEmail,
          likesCount: 0,
          likedBy: [],
          createdAt: new Date()
        }

        const result = await artworkCollection.insertOne(artworkData)
        
        if(result.insertedId) {
          res.send({
            success: true,
            message: "Artwork added successfully",
            id: result.insertedId
          })
        } else {
          res.status(400).send({
            success: false,
            message: "Failed to add artwork"
          })
        }
      } catch(err) {
        console.error("Error adding artwork:", err)
        res.status(500).send({
          success: false,
          error: "Failed to add artwork",
          message: err.message
        })
      }
    })

    // Update artwork
    app.put('/api/artworks/:id', async(req,res)=>{
      try {
        const { id } = req.params
        const updateData = {
          title: req.body.title,
          category: req.body.category,
          mediumTools: req.body.mediumTools || req.body.medium,
          description: req.body.description,
          dimensions: req.body.dimensions || '',
          price: req.body.price ? parseFloat(req.body.price) : 0,
          visibility: req.body.visibility,
          image: req.body.image || req.body.imageUrl,
          updatedAt: new Date()
        }

        const result = await artworkCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        )

        if(result.modifiedCount > 0 || result.matchedCount > 0) {
          res.send({
            success: true,
            message: "Artwork updated successfully"
          })
        } else {
          res.status(404).send({
            success: false,
            message: "Artwork not found"
          })
        }
      } catch(err) {
        console.error("Error updating artwork:", err)
        res.status(500).send({
          success: false,
          error: "Failed to update artwork"
        })
      }
    })

    // Delete artwork
    app.delete('/api/artworks/:id', async(req,res)=>{
      try {
        const { id } = req.params
        const result = await artworkCollection.deleteOne({
          _id: new ObjectId(id)
        })

        if(result.deletedCount > 0) {
          // Also delete from favorites
          await favoritesCollection.deleteMany({
            artworkId: new ObjectId(id)
          })

          res.send({
            success: true,
            message: "Artwork deleted successfully"
          })
        } else {
          res.status(404).send({
            success: false,
            message: "Artwork not found"
          })
        }
      } catch(err) {
        console.error("Error deleting artwork:", err)
        res.status(500).send({
          success: false,
          error: "Failed to delete artwork"
        })
      }
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // Start server only after connection is successful
    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`)
    })
  } catch(err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}

app.get('/', (req, res) => {
  res.send('Hello World!')
})

run().catch(console.dir);
